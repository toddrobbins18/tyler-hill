#!/usr/bin/env node
/**
 * Create (or repair) two Nest Training Sandbox staff accounts for Messages testing.
 *
 * Usage (from tyler-hill/):
 *   node scripts/create_nest_sandbox_test_staff.mjs
 *
 * Requires .env with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * (or VITE_SUPABASE_PUBLISHABLE_KEY won't work — need service role).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const SANDBOX_SLUG = "nest-sandbox-day-camp";
const STAFF_PASSWORD = "NestSandbox2027!";

const STAFF = [
  { email: "staff.alpha@nest-demo.example", fullName: "Sam Sandbox Staff" },
  { email: "staff.beta@nest-demo.example", fullName: "Jordan Sandbox Staff" },
];

function loadEnv() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) {
    console.error("Missing .env in tyler-hill/");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
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

async function findUserIdByEmail(admin, email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function ensureStaff(admin, companyId, { email, fullName }) {
  let userId = await findUserIdByEmail(admin, email);

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: STAFF_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        company_id: companyId,
        approved: true,
      },
    });
    if (error) throw new Error(`${email}: ${error.message}`);
    userId = data.user.id;
    console.log(`Created auth user: ${email}`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: STAFF_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        company_id: companyId,
        approved: true,
      },
    });
    if (error) throw new Error(`${email} update: ${error.message}`);
    console.log(`Updated existing user: ${email}`);
  }

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      approved: true,
      company_id: companyId,
    },
    { onConflict: "id" },
  );
  if (profileErr) throw new Error(`${email} profile: ${profileErr.message}`);

  const { error: roleErr } = await admin.from("user_roles").upsert(
    {
      user_id: userId,
      company_id: companyId,
      role: "staff",
    },
    { onConflict: "user_id,company_id" },
  );
  if (roleErr) throw new Error(`${email} role: ${roleErr.message}`);

  return userId;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: company, error: companyErr } = await admin
    .from("companies")
    .select("id, name")
    .eq("slug", SANDBOX_SLUG)
    .maybeSingle();

  if (companyErr || !company?.id) {
    console.error("Sandbox company not found. Run setup_nest_sandbox_day_camp.sql first.");
    process.exit(1);
  }

  console.log(`Company: ${company.name} (${company.id})\n`);

  for (const row of STAFF) {
    await ensureStaff(admin, company.id, row);
  }

  console.log("\n--- Sandbox staff test accounts (training only) ---");
  for (const row of STAFF) {
    console.log(`  ${row.fullName}`);
    console.log(`    Email:    ${row.email}`);
    console.log(`    Password: ${STAFF_PASSWORD}`);
  }
  console.log("\nSign in at /auth (incognito for second user). Open Nest Training Sandbox → Messages → Compose or Groups.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
