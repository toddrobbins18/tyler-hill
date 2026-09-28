import { describe, expect, it } from "vitest";
import {
  buildSwimFormationGroups,
  highestCompletedSwimLevel,
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

  it("splits by max campers per group", () => {
    const campers = [
      camper({ id: "1", name: "A" }),
      camper({ id: "2", name: "B" }),
      camper({ id: "3", name: "C" }),
    ];
    const groups = buildSwimFormationGroups(campers, { criteria: [], maxCampersPerGroup: 2 });
    expect(groups).toHaveLength(2);
    expect(groups[0].campers).toHaveLength(2);
    expect(groups[1].campers).toHaveLength(1);
  });

  it("groups by division and swim level when selected", () => {
    const campers = [
      camper({ id: "1", name: "A", division: "Junior", highestCompletedLevel: "Goldfish" }),
      camper({ id: "2", name: "B", division: "Junior", highestCompletedLevel: "Goldfish" }),
      camper({ id: "3", name: "C", division: "Senior", highestCompletedLevel: "Minnow" }),
    ];
    const groups = buildSwimFormationGroups(campers, {
      criteria: ["division", "swimLevel"],
      maxCampersPerGroup: 8,
    });
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toContain("Junior");
    expect(groups[0].label).toContain("Goldfish");
    expect(groups[0].campers).toHaveLength(2);
    expect(groups[1].campers).toHaveLength(1);
  });
});
