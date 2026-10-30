import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isAirtableSwimRecordsCsv,
  levelFromSkills,
  normalizeBraceletColor,
  normalizePassStatus,
  normalizeSwimTestNote,
  normalizeDivisionLeader,
  isBlankDivisionLeader,
  matchDivisionLeaderOption,
  resolveStoredDivisionLeader,
  normalizeSkillStatus,
  parseSwimProgramCsv,
  normalizeSwimImportParentEmail,
  inferImportSeasonFromFileName,
  swimLevelColumnVisible,
  swimHistoryRecordHasData,
  type RosterChild,
  type LevelRecord,
} from "@/lib/swimProgram";

const child: RosterChild = {
  id: "child-1",
  name: "Jane Doe",
  person_id: "cm-1",
  group_name: "Pandas",
  leader: null,
};

describe("swimProgram", () => {
  it("normalizes A/W and legacy labels", () => {
    expect(normalizeSkillStatus("A")).toBe("A");
    expect(normalizeSkillStatus("W")).toBe("W");
    expect(normalizeSkillStatus("Achieved")).toBe("A");
    expect(normalizeSkillStatus("Working Towards")).toBe("W");
    expect(normalizeSkillStatus("")).toBe("—");
  });

  it("computes level from A/W skills", () => {
    expect(levelFromSkills(["A", "A", "A", "A"])).toBe("Complete");
    expect(levelFromSkills(["A", "W", "—", "—"])).toBe("Incomplete");
    expect(levelFromSkills(["—", "—", "—", "—"])).toBe("—");
  });

  it("parses Airtable-style CSV rows", () => {
    const csv = [
      "name,current_bracelet,goldfish_1A1,goldfish_1A2,goldfish_1A3,goldfish_1A4",
      "Jane Doe,Orange,A,W,—,—",
    ].join("\n");
    const { rows, unmatched } = parseSwimProgramCsv(csv, [{ ...child, season: "2027" }], "2027");
    expect(unmatched).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].bracelet?.currentBracelet).toBe("Orange");
    expect(rows[0].levels?.goldfish).toEqual(["A", "W", "—", "—"]);
    expect(rows[0].levels?.goldfishLevel).toBe("Incomplete");
  });

  it("parses North Shore Swim Records 2026 export headers", () => {
    const headers = [
      "Child's Name",
      "Group",
      "PersonID",
      "Email",
      "Goldfish 1A1",
      "Goldfish 1A2",
      "Goldfish 1A3",
      "Goldfish 1A4",
      "Goldfish Level",
      "Minnow 1B1",
      "Red Cross Level 1",
    ];
    expect(isAirtableSwimRecordsCsv(headers)).toBe(true);

    const rosterChild: RosterChild = {
      ...child,
      person_id: "14679875",
      season: "2026",
    };
    const csv = [
      headers.join(","),
      "Freddy Sendach,Syracuse,14679875,parent@example.com,Achieved,Achieved,Achieved,Achieved,Complete,Achieved,Complete",
    ].join("\n");
    const { rows, unmatched } = parseSwimProgramCsv(csv, [rosterChild], "2026");
    expect(unmatched).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].guardianEmail).toBe("parent@example.com");
    expect(rows[0].season).toBe("2026");
    expect(rows[0].levels?.group).toBe("Syracuse");
    expect(rows[0].levels?.goldfish).toEqual(["A", "A", "A", "A"]);
    expect(rows[0].levels?.goldfishLevel).toBe("Complete");
    expect(rows[0].levels?.minnow?.[0]).toBe("A");
    expect(rows[0].levels?.redCross).toBe("Complete");
  });

  it("ignores non-email cells in Email column", () => {
    expect(normalizeSwimImportParentEmail("parent@example.com")).toBe("parent@example.com");
    expect(normalizeSwimImportParentEmail("")).toBeNull();
    expect(normalizeSwimImportParentEmail("https://example.com/x")).toBeNull();
    expect(normalizeSwimImportParentEmail("not-an-email")).toBeNull();
  });

  it("normalizes legacy pass and bracelet values", () => {
    expect(normalizeSwimTestNote("PASSED")).toBe("PASSED");
    expect(normalizeSwimTestNote("No Backfloat")).toBe("No Backfloat");
    expect(normalizePassStatus("PASSED")).toBe("Passed");
    expect(normalizePassStatus("did not pass")).toBe("Did Not Pass");
    expect(normalizeBraceletColor("orange")).toBe("Orange");
    expect(normalizeBraceletColor("Non Swimmer/Beginner")).toBe("Non Swimmer/Beginner");
    expect(normalizeBraceletColor("purple")).toBe("");
    expect(normalizeDivisionLeader("alyssa")).toBe("Alyssa");
    expect(normalizeDivisionLeader("CARLOTA")).toBe("CARLOTA");
    expect(isBlankDivisionLeader("—")).toBe(true);
    expect(matchDivisionLeaderOption("Alyssa Smith")).toBe("Alyssa");
    expect(
      resolveStoredDivisionLeader("", { ...child, leader: { name: "Jess Cohen" } }),
    ).toBe("Jess Cohen");
  });

  it("filters level report columns by Red Cross view", () => {
    expect(swimLevelColumnVisible("red-cross-1", "goldfish-0")).toBe(true);
    expect(swimLevelColumnVisible("red-cross-1", "minnow-0")).toBe(false);
    expect(swimLevelColumnVisible("red-cross-3", "frog")).toBe(true);
    expect(swimLevelColumnVisible("all", "redCross4")).toBe(true);
  });

  it("includes Red Cross / Frog-only rows in prior-season history eligibility", () => {
    const levelsOnlyRedCross: LevelRecord = {
      id: "c1",
      personId: "p1",
      name: "Test",
      group: "—",
      goldfish: ["—", "—", "—", "—"],
      goldfishLevel: "—",
      minnow: ["—", "—", "—", "—", "—", "—"],
      minnowLevel: "—",
      tadpole: ["—", "—", "—", "—"],
      tadpoleLevel: "—",
      redCross: "Complete",
      redCross2: "—",
      redCross3: "—",
      redCross4: "—",
      frog: "—",
      exitSkills: ["—", "—"],
      lastModified: "Imported",
    };
    expect(swimHistoryRecordHasData(null, levelsOnlyRedCross)).toBe(true);
    expect(swimHistoryRecordHasData(null, { ...levelsOnlyRedCross, redCross: "—", frog: "Complete" })).toBe(true);
  });

  it("parses Swim Bracelets 2026 grid (Division Leader, tests, bracelet color)", () => {
    const csv = [
      "Name,Group,Division Leader,Current Bracelet,Note Field ,1st Test Proctor,1st Testing Date,1st Note,Send Email",
      'Nicholas Hwang,Everest,Alyssa,Orange,,JT,"June 29, 2026",PASSED,checked',
    ].join("\n");
    const rosterChild: RosterChild = {
      ...child,
      name: "Nicholas Hwang",
      season: "2026",
    };
    const { rows, unmatched } = parseSwimProgramCsv(csv, [rosterChild], "2026");
    expect(unmatched).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].season).toBe("2026");
    expect(rows[0].bracelet?.currentBracelet).toBe("Orange");
    expect(rows[0].bracelet?.divisionLeader).toBe("Alyssa");
    expect(rows[0].bracelet?.proctor1).toBe("JT");
    expect(rows[0].bracelet?.note1).toBe("PASSED");
    expect(rows[0].bracelet?.emailSent).toBe(true);
  });

  it("infers import season from filename when Season column is absent", () => {
    expect(inferImportSeasonFromFileName("2026-Grid view(1).csv", "2027")).toBe("2026");
    expect(inferImportSeasonFromFileName("Swim Records 2026-ALL KIDS(1).csv", "2027")).toBe("2026");
  });

  it("matches PersonID across seasons when importing historical data", () => {
    const csv = [
      "Child's Name,PersonID,Goldfish 1A1",
      "Jane Doe,cm-1,Achieved",
    ].join("\n");
    const { rows } = parseSwimProgramCsv(
      csv,
      [{ ...child, season: "2027", person_id: "cm-1" }],
      "2026",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].season).toBe("2026");
    expect(rows[0].child.id).toBe("child-1");
  });
});

/** Minimal CSV line parser (matches swimProgram.parseCsvLine). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const campRoot = path.resolve(__dirname, "../../../..");
const toddBraceletCsv = path.join(campRoot, "2026-Grid view(1).csv");
const toddRecordsCsv = path.join(campRoot, "Swim Records 2026-ALL KIDS(1).csv");
const toddCsvOnDisk = fs.existsSync(toddBraceletCsv) && fs.existsSync(toddRecordsCsv);

describe.skipIf(!toddCsvOnDisk)("Todd Airtable CSV files (local dry-run)", () => {
  it("imports bracelet grid: colors, leaders, test rows", () => {
    const csv = fs.readFileSync(toddBraceletCsv, "utf8");
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const roster: RosterChild[] = [];
    let n = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const name = cols[0]?.trim();
      if (!name) continue;
      roster.push({
        id: `b-${n++}`,
        name,
        person_id: `bp-${n}`,
        group_name: cols[1]?.trim() ?? null,
        leader: null,
        season: "2026",
      });
    }
    const season = inferImportSeasonFromFileName("2026-Grid view(1).csv", "2027");
    const { rows, unmatched } = parseSwimProgramCsv(csv, roster, season);
    expect(season).toBe("2026");
    expect(rows.length).toBeGreaterThan(400);
    expect(unmatched.length).toBe(0);
    expect(rows.filter((r) => r.bracelet?.currentBracelet).length).toBeGreaterThan(400);
    expect(rows.filter((r) => r.bracelet?.divisionLeader).length).toBeGreaterThan(400);
    expect(rows.filter((r) => r.bracelet?.proctor1).length).toBeGreaterThan(200);
  });

  it("imports swim records levels when PersonID matches roster", () => {
    const csv = fs.readFileSync(toddRecordsCsv, "utf8");
    const lines = csv.split(/\r?\n/).filter((l) => l.trim());
    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const nameIdx = header.findIndex((h) => h.includes("child") && h.includes("name"));
    const personIdx = header.indexOf("personid");
    const groupIdx = header.indexOf("group");
    const roster: RosterChild[] = [];
    let n = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";
      const person_id = personIdx >= 0 ? cols[personIdx]?.trim() : "";
      if (!name || !person_id) continue;
      roster.push({
        id: `c-${n++}`,
        name,
        person_id,
        group_name: groupIdx >= 0 ? cols[groupIdx]?.trim() ?? null : null,
        leader: null,
        season: "2026",
      });
    }
    const { rows, unmatched } = parseSwimProgramCsv(csv, roster, "2026");
    expect(roster.length).toBeGreaterThan(400);
    expect(rows.length).toBeGreaterThan(400);
    expect(unmatched.length).toBeLessThan(20);
    expect(rows.filter((r) => r.levels).length).toBeGreaterThan(100);

    const withParentEmail = rows.filter((r) => r.guardianEmail);
    expect(withParentEmail.length).toBeGreaterThan(400);
    expect(withParentEmail[0]?.guardianEmail).toMatch(/@/);
    const jackson = rows.find((r) => r.child.name === "Jackson Gillespie");
    expect(jackson?.guardianEmail?.toLowerCase()).toBe("erinloeffler@gmail.com");
  });
});
