import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { parseSwimProgramCsv } = await import("../src/lib/swimProgram.ts");

const grid = readFileSync(resolve(root, "data/north_shore_2026_swim_bracelet_grid.csv"), "utf8");
const kids = readFileSync(resolve(root, "data/north_shore_2026_swim_records_all_kids.csv"), "utf8");

const names = ["Aaron Weissler", "Aayhan Kazmi", "Adam Detore"];
const roster = names.flatMap((name, i) => [
  {
    id: `2026-${i}`,
    name,
    person_id: String(16884602 + i * 100000),
    group_name: "G",
    leader: null,
    season: "2026",
  },
]);

// fix person ids from csv
roster[0].person_id = "16884602";
roster[1].person_id = "16517148";
roster[2].person_id = "17032930";

const merged = new Map();
for (const [label, csv] of [
  ["GRID", grid],
  ["KIDS", kids],
]) {
  const { rows, unmatched } = parseSwimProgramCsv(csv, roster, "2026");
  console.log(`\n${label} unmatched:`, unmatched.filter((u) => names.some((n) => u.includes(n))));
  for (const name of names) {
    const r = rows.find((x) => x.child.name === name);
    if (!r) {
      console.log(`${label} ${name}: no row`);
      continue;
    }
    const key = name;
    const prev = merged.get(key) ?? { name };
    if (r.bracelet) Object.assign(prev, { bracelet: r.bracelet.currentBracelet || "—", gridNote: r.bracelet.generalNote });
    if (r.levels) {
      prev.goldfish = r.levels.goldfish?.filter((s) => s !== "—").length ?? 0;
      prev.frog = r.levels.frog;
      prev.goldfishLevel = r.levels.goldfishLevel;
    }
    merged.set(key, prev);
  }
}

console.log("\n=== CSV expected (2026 merge) ===");
for (const v of merged.values()) console.log(v);
