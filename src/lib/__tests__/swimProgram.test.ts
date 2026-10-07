import { describe, expect, it } from "vitest";
import {
  isAirtableSwimRecordsCsv,
  levelFromSkills,
  normalizeBraceletColor,
  normalizePassStatus,
  normalizeSwimTestNote,
  normalizeDivisionLeader,
  normalizeSkillStatus,
  parseSwimProgramCsv,
  swimLevelColumnVisible,
  type RosterChild,
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
      "Freddy Sendach,Syracuse,14679875,Achieved,Achieved,Achieved,Achieved,Complete,Achieved,Complete",
    ].join("\n");
    const { rows, unmatched } = parseSwimProgramCsv(csv, [rosterChild], "2026");
    expect(unmatched).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].season).toBe("2026");
    expect(rows[0].levels?.group).toBe("Syracuse");
    expect(rows[0].levels?.goldfish).toEqual(["A", "A", "A", "A"]);
    expect(rows[0].levels?.goldfishLevel).toBe("Complete");
    expect(rows[0].levels?.minnow?.[0]).toBe("A");
    expect(rows[0].levels?.redCross).toBe("Complete");
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
  });

  it("filters level report columns by Red Cross view", () => {
    expect(swimLevelColumnVisible("red-cross-1", "goldfish-0")).toBe(true);
    expect(swimLevelColumnVisible("red-cross-1", "minnow-0")).toBe(false);
    expect(swimLevelColumnVisible("red-cross-3", "frog")).toBe(true);
    expect(swimLevelColumnVisible("all", "redCross4")).toBe(true);
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
