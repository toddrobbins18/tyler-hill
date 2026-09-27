import { describe, expect, it } from "vitest";
import { mapBunkingRosterChild, type BunkingRosterChildRow } from "@/lib/bunkingRoster";

describe("bunkingRoster", () => {
  it("prefers division name, then grade, group, category", () => {
    const base: BunkingRosterChildRow = {
      id: "c1",
      name: "Jane Doe",
      gender: "Female",
      grade: "3rd Grade",
      group_name: "Blue Jays",
      status: "active",
      division: { name: " Grade 3 " },
    };

    expect(mapBunkingRosterChild(base).division).toBe("Grade 3");
    expect(mapBunkingRosterChild({ ...base, division: null }).division).toBe("3rd Grade");
    expect(
      mapBunkingRosterChild({ ...base, division: null, grade: null }).division,
    ).toBe("Blue Jays");
  });
});
