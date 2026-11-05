import { describe, expect, it } from "vitest";
import { busRostersFromBoard, campersForBus, campersForGroup, type AudienceCamper } from "@/lib/audienceMessaging";

const campers: AudienceCamper[] = [
  { id: "1", name: "Ada", groupName: "Bunnies", enrolledWeeks: [1, 2], session: null },
  { id: "2", name: "Bea", groupName: "Bunnies", enrolledWeeks: [3], session: null },
  { id: "3", name: "Cal", groupName: "Dolphins", enrolledWeeks: [1], session: null },
];

describe("audience messaging", () => {
  it("keeps a group to campers enrolled in the chosen weeks", () => {
    expect(campersForGroup(campers, "Bunnies", [1], false).map((row) => row.name)).toEqual(["Ada"]);
    expect(campersForGroup(campers, "Bunnies", [1, 3], false).map((row) => row.name)).toEqual(["Ada", "Bea"]);
  });

  it("can include everyone in the group", () => {
    expect(campersForGroup(campers, "Bunnies", [], true).map((row) => row.name)).toEqual(["Ada", "Bea"]);
  });

  it("filters a bus the same way", () => {
    expect(campersForBus(campers, ["Ada", "Cal"], [3], false)).toEqual([]);
    expect(campersForBus(campers, ["Ada", "Cal"], [1], false).map((row) => row.name)).toEqual(["Ada", "Cal"]);
    expect(campersForBus(campers, ["Ada", "Bea"], [], true).map((row) => row.name)).toEqual(["Ada", "Bea"]);
  });

  it("reads bus labels and rider names from a saved board", () => {
    const buses = busRostersFromBoard({
      routeMeta: [{ id: 2, name: "North", bus: "4" }],
      coreStops: { 2: [{ name: "Camp" }, { camperNames: ["Ada", "Bea"] }] },
    });
    expect(buses).toEqual([{ id: "2", label: "Bus 4 · North", camperNames: ["Ada", "Bea"] }]);
  });
});
