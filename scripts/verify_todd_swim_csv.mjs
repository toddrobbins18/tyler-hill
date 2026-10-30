/**
 * Dry-run Todd's Airtable CSVs against parseSwimProgramCsv (no Supabase).
 * Run: node scripts/verify_todd_swim_csv.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const campRoot = path.resolve(__dirname, "../..");
const braceletPath = path.join(campRoot, "2026-Grid view(1).csv");
const recordsPath = path.join(campRoot, "Swim Records 2026-ALL KIDS(1).csv");

const swimUrl = pathToFileURL(path.join(__dirname, "../src/lib/swimProgram.ts")).href;
const {
  parseSwimProgramCsv,
  inferImportSeasonFromFileName,
} = await import(swimUrl);

function rosterFromRecordsCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(
    (h) => h.includes("child") && h.includes("name") || h === "name",
  );
  const personIdx = headers.findIndex((h) => h === "personid" || h === "person_id");
  const groupIdx = headers.findIndex((h) => h === "group");
  const out = [];
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";
    const person_id = personIdx >= 0 ? String(cols[personIdx] ?? "").trim() : `syn-${n}`;
    const group_name = groupIdx >= 0 ? cols[groupIdx]?.trim() : null;
    if (!name) continue;
    out.push({
      id: `child-${n++}`,
      name,
      person_id,
      group_name,
      leader: null,
      season: "2026",
    });
  }
  return out;
}

function rosterFromBraceletCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf("name");
  const groupIdx = headers.indexOf("group");
  const out = [];
  let n = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";
    if (!name) continue;
    out.push({
      id: `b-${n++}`,
      name,
      person_id: `b-person-${n}`,
      group_name: groupIdx >= 0 ? cols[groupIdx]?.trim() : null,
      leader: null,
      season: "2026",
    });
  }
  return out;
}

function summarize(label, fileName, csvText, roster) {
  const season = inferImportSeasonFromFileName(fileName, "2027");
  const { rows, unmatched } = parseSwimProgramCsv(csvText, roster, season);
  const withBracelet = rows.filter((r) => r.bracelet?.currentBracelet || r.bracelet?.divisionLeader).length;
  const withLevels = rows.filter((r) => r.levels).length;
  const withLeader = rows.filter((r) => r.bracelet?.divisionLeader).length;
  const withTests = rows.filter((r) => r.bracelet?.proctor1 || r.bracelet?.date1).length;

  console.log(`\n=== ${label} ===`);
  console.log(`File: ${fileName}`);
  console.log(`Inferred season: ${season}`);
  console.log(`Roster size (synthetic): ${roster.length}`);
  console.log(`Matched rows: ${rows.length}`);
  console.log(`Unmatched: ${unmatched.length}${unmatched.length ? ` (e.g. ${unmatched.slice(0, 3).join("; ")})` : ""}`);
  console.log(`  → bracelet data: ${withBracelet} (leader: ${withLeader}, tests: ${withTests})`);
  console.log(`  → level/skill data: ${withLevels}`);
  if (rows[0]?.bracelet) {
    const b = rows[0].bracelet;
    console.log(`Sample bracelet: ${rows[0].child.name} | ${b.currentBracelet ?? "—"} | ${b.divisionLeader ?? "—"} | ${b.proctor1 ?? ""} ${b.date1 ?? ""}`);
  }
  if (rows[0]?.levels) {
    console.log(`Sample levels: ${rows[0].child.name} | goldfish ${JSON.stringify(rows[0].levels?.goldfish?.slice(0, 2))}`);
  }
}

for (const p of [braceletPath, recordsPath]) {
  if (!fs.existsSync(p)) {
    console.error("Missing file:", p);
    process.exit(1);
  }
}

const braceletCsv = fs.readFileSync(braceletPath, "utf8");
const recordsCsv = fs.readFileSync(recordsPath, "utf8");

summarize(
  "Swim Bracelets grid",
  "2026-Grid view(1).csv",
  braceletCsv,
  rosterFromBraceletCsv(braceletCsv),
);

summarize(
  "Swim Records 2026",
  "Swim Records 2026-ALL KIDS(1).csv",
  recordsCsv,
  rosterFromRecordsCsv(recordsCsv),
);

console.log("\n✓ Parser dry-run done. Production match rate depends on CampMinder roster + PersonID in Nest.\n");
