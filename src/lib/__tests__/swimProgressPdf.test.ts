import { describe, expect, it } from "vitest";
import { RED_CROSS_1_CHECKBOXES, listAchievedSkillIds } from "@/lib/swimProgressPdf";
import type { LevelRecord } from "@/lib/swimProgram";

const baseLevel = (): LevelRecord => ({
  id: "c1",
  personId: "p1",
  name: "Jane Doe",
  group: "Pandas",
  goldfish: ["A", "W", "—", "—"],
  goldfishLevel: "Working",
  minnow: ["A", "A", "W", "—", "—", "—"],
  minnowLevel: "Working",
  tadpole: ["—", "—", "—", "—"],
  tadpoleLevel: "—",
  redCross: "—",
  redCross2: "—",
  redCross3: "—",
  redCross4: "—",
  frog: "—",
  exitSkills: ["A", "—"],
  lastModified: "—",
});

describe("swimProgressPdf", () => {
  it("maps all RC1 skills to checkbox positions", () => {
    expect(RED_CROSS_1_CHECKBOXES).toHaveLength(16);
    expect(RED_CROSS_1_CHECKBOXES.map((b) => b.skillId)).toEqual([
      "1A1",
      "1A2",
      "1A3",
      "1A4",
      "1B1",
      "1B2",
      "1B3",
      "1B4",
      "1B5",
      "1B6",
      "1C1",
      "1C2",
      "1C3",
      "1C4",
      "EXIT1",
      "EXIT2",
    ]);
  });

  it("lists achieved skill ids from A/W data", () => {
    expect(listAchievedSkillIds("red-cross-1", baseLevel())).toEqual(["1A1", "1B1", "1B2", "EXIT1"]);
  });
});
