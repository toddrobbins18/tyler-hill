import { describe, expect, it } from "vitest";
import {
  buildBusBubbleSheetRoutes,
  buildPtOnlyBubbleSheetCampers,
  camperScheduledForBusRun,
  getCamperBusRunMode,
} from "@/lib/transportCamperBusRun";

describe("transportCamperBusRun", () => {
  it("defaults to full day AM and PM", () => {
    expect(getCamperBusRunMode({}, "Todd Robbins")).toBe("both");
    expect(camperScheduledForBusRun("both", "am")).toBe(true);
    expect(camperScheduledForBusRun("both", "pm")).toBe(true);
  });

  it("mini day is AM only", () => {
    expect(camperScheduledForBusRun("am_only", "am")).toBe(true);
    expect(camperScheduledForBusRun("am_only", "pm")).toBe(false);
  });

  it("builds routes when enrollmentLookup is omitted", () => {
    const stop = {
      name: "Todd",
      address: "1 Main St",
      lat: 0,
      lng: 0,
      passengers: 1,
      camperNames: ["Todd"],
    };
    const routes = buildBusBubbleSheetRoutes({
      routes: [{ id: 2, bus: "Bus 02", routeName: "Route B" }],
      baseCoreByRoute: () => [stop],
      coreForRun: () => [stop],
      schedules: {},
      runDate: "2027-07-06",
      enrollmentWeek: 2,
      enrollmentLookup: undefined,
    });
    expect(routes).toHaveLength(1);
  });

  it("includes parent-transport campers on the bus roster", () => {
    const stop = {
      name: "Alex",
      address: "1 Main St",
      lat: 0,
      lng: 0,
      passengers: 1,
      camperNames: ["Alex"],
      pickupTime: "7:00 AM",
    };
    const routes = buildBusBubbleSheetRoutes({
      routes: [{ id: 3, bus: "Bus 3", routeName: "Route 3" }],
      baseCoreByRoute: () => [stop],
      coreForRun: () => [stop],
      schedules: {},
      runDate: "2027-07-01",
      parentTransportCampers: [
        {
          id: 9,
          name: "Sam PT",
          routeId: 3,
          am: true,
          pm: true,
          weekdays: [],
        },
      ],
    });
    expect(routes[0]!.campers.map((c) => c.name).sort()).toEqual(["Alex", "Sam PT"]);
    const sam = routes[0]!.campers.find((c) => c.name === "Sam PT");
    expect(sam?.detail).toMatch(/PT/i);
    expect(sam?.ridesAm).toBe(true);
    expect(sam?.ridesPm).toBe(true);
  });

  it("builds a PT-only roster for campers with no bus", () => {
    const campers = buildPtOnlyBubbleSheetCampers({
      runDate: "2027-07-01",
      parentTransportCampers: [
        { id: 1, name: "No Bus Kid", routeId: null, am: true, pm: false, weekdays: [] },
        { id: 2, name: "On Bus Kid", routeId: 3, am: true, pm: true, weekdays: [] },
      ],
    });
    expect(campers).toHaveLength(1);
    expect(campers[0]!.name).toBe("No Bus Kid");
    expect(campers[0]!.ridesAm).toBe(true);
    expect(campers[0]!.ridesPm).toBe(false);
  });

  it("includes PT kids assigned to a bus when building the Parent Transport roster", () => {
    const campers = buildPtOnlyBubbleSheetCampers({
      runDate: "2027-07-01",
      includeAssignedToBus: true,
      busLabelForRoute: (id) => `Bus ${id}`,
      parentTransportCampers: [
        { id: 1, name: "No Bus Kid", routeId: null, am: true, pm: false, weekdays: [] },
        { id: 2, name: "On Bus Kid", routeId: 3, am: true, pm: true, weekdays: [] },
      ],
    });
    expect(campers.map((c) => c.name)).toEqual(["No Bus Kid", "On Bus Kid"]);
    expect(campers.find((c) => c.name === "On Bus Kid")?.detail).toContain("Bus 3");
  });

  it("marks PM bubble off for mini day on the bus sheet", () => {
    const routes = buildBusBubbleSheetRoutes({
      routes: [{ id: 1, bus: "Bus 10", routeName: "Route A" }],
      baseCoreByRoute: () => [
        {
          name: "Todd",
          address: "1 Main St",
          lat: 0,
          lng: 0,
          passengers: 1,
          camperNames: ["Todd"],
        },
      ],
      coreForRun: () => [
        {
          name: "Todd",
          address: "1 Main St",
          lat: 0,
          lng: 0,
          passengers: 1,
          camperNames: ["Todd"],
        },
      ],
      schedules: { todd: "am_only" },
      runDate: "2027-07-06",
    });

    expect(routes).toHaveLength(1);
    const todd = routes[0]!.campers.find((c) => c.name === "Todd");
    expect(todd?.ridesAm).toBe(true);
    expect(todd?.ridesPm).toBe(false);
  });
});
