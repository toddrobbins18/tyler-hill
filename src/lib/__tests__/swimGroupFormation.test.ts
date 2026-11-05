import { describe, expect, it } from "vitest";
import {
  buildSwimFormationGroups,
  buildSwimPeriodGroups,
  highestCompletedSwimLevel,
  splitBalancedByInstructors,
  type SwimFormationCamper,
} from "@/lib/swimGroupFormation";
import { levelFromChild, type RosterChild } from "@/lib/swimProgram";

const child: RosterChild = {
  id: "1",
  name: "Amy Adams",
  person_id: "p1",
  group_name: "Pandas",
  leader: { name: "Coach A" },
};

function camper(overrides: Partial<SwimFormationCamper> & { name: string; id: string }): SwimFormationCamper {
  return {
    personId: overrides.id,
    division: "Junior",
    group: "Pandas",
    divisionLeader: "Coach A",
    highestCompletedLevel: "Goldfish",
    ...overrides,
  };
}

describe("swimGroupFormation", () => {
  it("reports highest completed swim level", () => {
    const level = levelFromChild(child);
    level.goldfishLevel = "Complete";
    level.minnowLevel = "Complete";
    expect(highestCompletedSwimLevel(level)).toBe("Minnow");
    expect(highestCompletedSwimLevel(levelFromChild(child))).toBe("No level complete yet");
  });

  it("splitBalancedByInstructors balances group sizes", () => {
    expect(splitBalancedByInstructors(["a", "b", "c", "d", "e"], 3)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("splits by instructor count instead of max campers", () => {
    const campers = [
      camper({ id: "1", name: "A" }),
      camper({ id: "2", name: "B" }),
      camper({ id: "3", name: "C" }),
      camper({ id: "4", name: "D" }),
      camper({ id: "5", name: "E" }),
    ];
    const groups = buildSwimFormationGroups(campers, { criteria: [], instructorCount: 2 });
    expect(groups).toHaveLength(2);
    expect(groups[0].campers).toHaveLength(3);
    expect(groups[1].campers).toHaveLength(2);
  });

  it("never mixes division leaders in the same group", () => {
    const campers = [
      camper({ id: "1", name: "A", divisionLeader: "Leader One" }),
      camper({ id: "2", name: "B", divisionLeader: "Leader One" }),
      camper({ id: "3", name: "C", divisionLeader: "Leader Two" }),
      camper({ id: "4", name: "D", divisionLeader: "Leader Two" }),
    ];
    const groups = buildSwimFormationGroups(campers, {
      criteria: ["swimLevel"],
      instructorCount: 1,
    });
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      const leaders = new Set(group.campers.map((c) => c.divisionLeader));
      expect(leaders.size).toBe(1);
    }
  });

  it("groups by division and swim level when selected", () => {
    const campers = [
      camper({ id: "1", name: "A", division: "Junior", highestCompletedLevel: "Goldfish" }),
      camper({ id: "2", name: "B", division: "Junior", highestCompletedLevel: "Goldfish" }),
      camper({ id: "3", name: "C", division: "Senior", highestCompletedLevel: "Minnow" }),
    ];
    const groups = buildSwimFormationGroups(campers, {
      criteria: ["division", "swimLevel", "divisionLeader"],
      instructorCount: 1,
    });
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toContain("Junior");
    expect(groups[0].label).toContain("Goldfish");
    expect(groups[0].campers).toHaveLength(2);
    expect(groups[1].campers).toHaveLength(1);
  });

  it("builds one period group that can mix selected camp groups", () => {
    const campers = [
      ...Array.from({ length: 6 }, (_, i) =>
        camper({
          id: `c${i}`,
          name: `Cheetah ${i}`,
          group: "Cheetahs",
          highestCompletedLevel: "Goldfish",
        }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        camper({
          id: `p${i}`,
          name: `Panther ${i}`,
          group: "Panthers",
          highestCompletedLevel: "Goldfish",
        }),
      ),
      camper({ id: "l1", name: "Lion Kid", group: "Lions", highestCompletedLevel: "Minnow" }),
    ];

    const groups = buildSwimPeriodGroups(campers, ["Cheetahs", "Panthers"], 1);
    expect(groups).toHaveLength(1);
    expect(groups[0].campers).toHaveLength(10);
    expect(groups[0].campers.some((c) => c.group === "Lions")).toBe(false);
    expect(groups[0].label).toContain("6 Cheetahs");
    expect(groups[0].label).toContain("4 Panthers");
    expect(groups[0].label).toContain("Goldfish");
  });

  it("keeps a camp group together and mixes only the remainder", () => {
    const campers = [
      ...Array.from({ length: 6 }, (_, i) =>
        camper({ id: `c${i}`, name: `C${String(i).padStart(2, "0")}`, group: "Cheetahs" }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        camper({ id: `p${i}`, name: `P${String(i).padStart(2, "0")}`, group: "Panthers" }),
      ),
    ];

    const groups = buildSwimPeriodGroups(campers, ["cheetahs", "panthers"], 2);
    expect(groups).toHaveLength(2);
    expect(groups[0].campers.every((c) => c.group === "Cheetahs")).toBe(true);
    expect(groups[1].campers.some((c) => c.group === "Panthers")).toBe(true);
    expect(groups[1].campers.some((c) => c.group === "Cheetahs")).toBe(true);
  });
});
