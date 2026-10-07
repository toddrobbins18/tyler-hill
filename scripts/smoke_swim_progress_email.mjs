#!/usr/bin/env node
/**
 * Smoke test: sign in → find camper with swim levels + parent email → invoke send-swim-progress-email.
 *
 * Usage:
 *   SMOKE_EMAIL=you@camp.com SMOKE_PASSWORD='secret' node scripts/smoke_swim_progress_email.mjs
 *   node scripts/smoke_swim_progress_email.mjs --dry-run   # no send, only discovery
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const NS_COMPANY_ID = "0d98861f-d956-4bfb-b273-851b3ae56d5c";

function loadEnv() {
  const envPath = resolve(root, ".env");
  const text = readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function log(step, msg, extra) {
  const prefix = `[smoke ${step}]`;
  if (extra !== undefined) console.log(prefix, msg, extra);
  else console.log(prefix, msg);
}

function fail(step, msg) {
  console.error(`[smoke FAIL ${step}]`, msg);
  process.exit(1);
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!url || !anonKey) fail("config", "Missing VITE_SUPABASE_URL or publishable key in .env");
if (!email || !password) fail("config", "Set SMOKE_EMAIL and SMOKE_PASSWORD env vars");

const supabase = createClient(url, anonKey);

async function main() {
  log("1-auth", "Signing in…", email);
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr || !auth.session) fail("auth", authErr?.message ?? "No session");

  log("2-profile", "Loading profile…");
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, companies(name)")
    .eq("id", auth.user.id)
    .single();
  if (profileErr || !profile?.company_id) fail("profile", profileErr?.message ?? "No company_id");

  const profileCompanyId = profile.company_id;
  const companyId = process.env.SMOKE_COMPANY_ID || profileCompanyId;
  const campName = profile.companies?.name ?? "Camp";
  log("2-profile", "OK", {
    profileCompanyId,
    usingCompanyId: companyId,
    campName,
    user: profile.full_name,
  });

  if (companyId !== profileCompanyId) {
    log("2-profile", "Note: using SMOKE_COMPANY_ID override (edge send may fail Company mismatch until camp switch is supported)");
  }

  log("2b-function", "Checking edge function is deployed…");
  const fnProbe = await fetch(`${url}/functions/v1/send-swim-progress-email`, {
    method: "OPTIONS",
    headers: { apikey: anonKey },
  });
  if (fnProbe.status === 404) {
    fail("function", "send-swim-progress-email not deployed. Run: supabase functions deploy send-swim-progress-email");
  }
  log("2b-function", "Edge function reachable", fnProbe.status);

  const { data: emailCfg } = await supabase
    .from("company_email_config")
    .select("is_configured,is_active,m365_sender_email")
    .eq("company_id", companyId)
    .maybeSingle();
  log("2c-email", "Camp email config", emailCfg ?? "(not configured — Admin → Email Config for North Shore)");

  log("3-season", "Finding latest season with swim data…");
  const { data: swimRows, error: swimErr } = await supabase
    .from("swim_program_records")
    .select("child_id, season, levels")
    .eq("company_id", companyId)
    .not("levels", "is", null)
    .order("season", { ascending: false })
    .limit(50);

  if (swimErr) fail("swim", swimErr.message);
  if (!swimRows?.length) fail("swim", "No swim level records found for this camp");

  const candidate = swimRows.find((r) => r.levels && typeof r.levels === "object");
  if (!candidate) fail("swim", "No rows with levels JSON");

  const season = String(candidate.season);
  const childId = candidate.child_id;
  log("3-season", "Using season + child", { season, childId });

  log("4-child", "Loading camper…");
  const { data: child, error: childErr } = await supabase
    .from("children")
    .select("id, name, guardian_email, season")
    .eq("id", childId)
    .eq("company_id", companyId)
    .single();
  if (childErr || !child) fail("child", childErr?.message ?? "Camper not found");

  const parentEmail = child.guardian_email?.trim();
  log("4-child", "Camper", { name: child.name, parentEmail: parentEmail ?? "(none)" });
  if (!parentEmail) fail("child", "Selected camper has no guardian_email — pick another or add email in CampMinder/roster");

  const levels = candidate.levels;
  const achieved = [];
  for (const [group, arr] of Object.entries(levels)) {
    if (!Array.isArray(arr)) continue;
    arr.forEach((v, i) => {
      if (v === "A") achieved.push(`${group}[${i}]`);
    });
  }
  log("5-levels", "Achieved skills in DB", achieved.length ? achieved.join(", ") : "(none — email will still send)");

  if (dryRun) {
    log("done", "DRY RUN — would invoke send-swim-progress-email", {
      company_id: companyId,
      child_id: childId,
      season,
      level_id: "red-cross-1",
      recipient: parentEmail,
    });
    return;
  }

  log("6-send", "Invoking edge function send-swim-progress-email…");
  const { data, error } = await supabase.functions.invoke("send-swim-progress-email", {
    body: {
      company_id: companyId,
      child_id: childId,
      season,
      level_id: "red-cross-1",
    },
  });

  if (error) fail("send", error.message);
  if (!data?.success) fail("send", data?.error ?? JSON.stringify(data));

  log("done", "SUCCESS", {
    recipient: data.recipient,
    subject: data.subject,
    pdfAttached: data.pdfAttached,
    note: "PDF is built in browser UI; this API smoke test sends email body only unless pdf_base64 is passed",
  });
}

main().catch((err) => fail("unexpected", err instanceof Error ? err.message : String(err)));
