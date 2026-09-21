import { describe, expect, it } from "vitest";
import {
  levelFromSkills,
  normalizeSkillStatus,
  parseSwimProgramCsv,
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
});
