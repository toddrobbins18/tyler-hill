#!/usr/bin/env node
/**
 * Import Todd's 2026 Swim Bracelets Airtable grid into swim_program_records (season 2026).
 * Each matched camper gets bracelet/proctor/test fields exactly as in the CSV (prior-year history).
 *
 * Usage (from tyler-hill/):
 *   npm run import:swim-bracelet-2026
 *   npm run import:swim-bracelet-2026 -- --dry-run
 *   npm run import:swim-bracelet-2026 -- --csv path/to/file.csv
 *
 * Requires .env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const DEFAULT_CSV = resolve(root, "data/north_shore_2026_swim_bracelet_grid.csv");
const COMPANY_SLUG = "north-shore-day-camp";

const dryRun = process.argv.includes("--dry-run");
const csvArgIdx = process.argv.indexOf("--csv");
const csvPath = csvArgIdx >= 0 ? resolve(process.argv[csvArgIdx + 1] ?? "") : DEFAULT_CSV;

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

async function main() {
  if (!existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  const { importSwimProgramCsv, inferImportSeasonFromFileName, parseSwimProgramCsv, fetchAllSwimRosterChildren } =
    await import("../src/lib/swimProgram.ts");

  const csvText = readFileSync(csvPath, "utf8");
  const fileName = csvPath.split("/").pop() ?? "2026-Grid view(1).csv";
  const importSeason = inferImportSeasonFromFileName(fileName, "2027");

  if (dryRun) {
    const env = loadEnv();
    const url = env.VITE_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for dry-run roster match");
      process.exit(1);
    }
    const supabase = createClient(url, key);
    const { data: company } = await supabase.from("companies").select("id").eq("slug", COMPANY_SLUG).maybeSingle();
    if (!company?.id) {
      console.error("Company not found:", COMPANY_SLUG);
      process.exit(1);
    }
    const children = await fetchAllSwimRosterChildren(supabase, company.id);
    const { rows, unmatched } = parseSwimProgramCsv(csvText, children, importSeason);
    console.log(`Season: ${importSeason}`);
    console.log(`Roster children (all seasons): ${children.length}`);
    console.log(`Matched: ${rows.length}`);
    console.log(`Unmatched: ${unmatched.length}`);
    if (unmatched.length) {
      console.log("Unmatched sample:", unmatched.slice(0, 15).join("; "));
    }
    process.exit(unmatched.length ? 2 : 0);
  }

  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", COMPANY_SLUG)
    .maybeSingle();
  if (companyErr) throw companyErr;
  if (!company?.id) {
    console.error("Company not found:", COMPANY_SLUG);
    process.exit(1);
  }

  console.log(`Importing ${csvPath} → ${COMPANY_SLUG} (season ${importSeason})…`);

  const result = await importSwimProgramCsv(supabase, company.id, csvText, importSeason, (p) => {
    process.stdout.write(`\r${p.message} (${p.current}/${p.total})`);
  }, { fileName });

  console.log("\nDone.");
  console.log(`  Bracelet rows: ${result.bracelets}`);
  console.log(`  Level rows: ${result.levels}`);
  console.log(`  Matched: ${result.matched}`);
  console.log(`  Unmatched: ${result.unmatched.length}`);
  if (result.unmatched.length) {
    console.log("  Sample unmatched:", result.unmatched.slice(0, 20).join("; "));
  }
  console.log("  Seasons saved:", result.seasons.join(", ") || importSeason);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
