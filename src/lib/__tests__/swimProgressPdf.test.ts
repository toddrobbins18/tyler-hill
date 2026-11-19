import { describe, expect, it } from "vitest";
import {
  RED_CROSS_1_CHECKBOXES,
  RED_CROSS_2_CHECKBOXES,
  RED_CROSS_3_CHECKBOXES,
  RED_CROSS_4_CHECKBOXES,
  getChartCheckboxes,
  listAchievedSkillIds,
} from "@/lib/swimProgressPdf";
import { emptyRcProgressSkills, type LevelRecord } from "@/lib/swimProgram";

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
  ...emptyRcProgressSkills(),
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

  it("maps RC2–4 skills onto chart checkbox layouts", () => {
    expect(getChartCheckboxes("red-cross-2")).toHaveLength(18);
    expect(getChartCheckboxes("red-cross-3")).toHaveLength(21);
    expect(getChartCheckboxes("red-cross-4")).toHaveLength(17);
    expect(RED_CROSS_2_CHECKBOXES.map((b) => b.skillId).slice(0, 5)).toEqual(["2A1", "2A2", "2A3", "2A4", "2A5"]);
    expect(RED_CROSS_3_CHECKBOXES.at(-1)?.skillId).toBe("EXIT2");
    expect(RED_CROSS_4_CHECKBOXES.at(-1)?.skillId).toBe("EXIT4");
  });

  it("lists achieved RC2 skill ids from Nest A/W arrays", () => {
    const rc2 = baseLevel();
    rc2.rc2Frog = ["A", "W", "—", "A", "—"];
    rc2.rc2Exit = ["A", "—", "W"];
    expect(listAchievedSkillIds("red-cross-2", rc2)).toEqual(["2A1", "2A4", "EXIT1"]);
  });
});
