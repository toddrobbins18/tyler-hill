import { describe, expect, it } from "vitest";
import {
  filterUnplottedExcludingParentTransport,
  isParentTransportBusAssigned,
  isParentTransportScheduledForRun,
  parentTransportBusLabel,
  PARENT_TRANSPORT_NO_BUS_LABEL,
  parentTransportRidersForRoute,
  ridersOnRoute,
  stripParentTransportFromCoreStops,
} from "@/lib/transportParentTransport";

describe("transportParentTransport", () => {
  it("removes PT campers from bus route stops", () => {
    const coreStops = stripParentTransportFromCoreStops(
      {
        1: [
          {
            name: "Andi Robbins",
            address: "1 Main St",
            lat: 40.88,
            lng: -73.64,
            pickupTime: "7:10 AM",
            passengers: 1,
            camperNames: ["Andi Robbins"],
          },
          {
            name: "Bus Kid",
            address: "2 Oak Ave",
            lat: 40.89,
            lng: -73.65,
            pickupTime: "7:15 AM",
            passengers: 1,
            camperNames: ["Bus Kid"],
          },
        ],
      },
      [
        {
          id: 1,
          name: "Andi Robbins",
          routeId: null,
          am: true,
          pm: true,
          weekdays: [],
        },
      ],
    );
    expect(coreStops[1]?.[0]?.camperNames).toEqual([]);
    expect(coreStops[1]?.[0]?.passengers).toBe(0);
    expect(coreStops[1]?.[1]?.camperNames).toEqual(["Bus Kid"]);
  });

  it("filters PT campers out of unplotted list", () => {
    const filtered = filterUnplottedExcludingParentTransport(
      [{ name: "Jamie Lee" }, { name: "Alex Smith" }],
      [
        {
          id: 1,
          name: "Jamie Lee",
          routeId: 7,
          am: true,
          pm: true,
          weekdays: [],
        },
      ],
    );
    expect(filtered.map((c) => c.name)).toEqual(["Alex Smith"]);
  });

  it("respects weekday and AM/PM schedule", () => {
    const camper = {
      id: 1,
      name: "Jamie Lee",
      routeId: 7,
      am: true,
      pm: false,
      weekdays: ["mon", "wed"] as const,
    };

    expect(
      isParentTransportScheduledForRun(camper, "2027-07-05", "am"),
    ).toBe(true);
    expect(
      isParentTransportScheduledForRun(camper, "2027-07-06", "am"),
    ).toBe(false);
    expect(
      isParentTransportScheduledForRun(camper, "2027-07-05", "pm"),
    ).toBe(false);
  });

  it("merges PT riders onto a route for reports and attendance", () => {
    const riders = ridersOnRoute(
      7,
      [
        {
          name: "Bus Rider",
          address: "1 Main St",
          lat: 40.88,
          lng: -73.64,
          pickupTime: "7:10 AM",
          passengers: 1,
          camperNames: ["Bus Rider"],
        },
      ],
      [
        {
          id: 2,
          name: "PT Camper",
          routeId: 7,
          am: true,
          pm: true,
          weekdays: [],
        },
      ],
      { runDate: "2027-07-07", runPeriod: "am" },
    );

    expect(riders.map((r) => r.name)).toEqual(["Bus Rider", "PT Camper"]);
    expect(riders.find((r) => r.name === "PT Camper")?.isParentTransport).toBe(true);
    expect(riders.find((r) => r.name === "PT Camper")?.stopName).toContain("Parent Transport");
  });

  it("lists PT riders for a route without bus stops", () => {
    const riders = parentTransportRidersForRoute(
      12,
      [
        {
          id: 3,
          name: "Parent Dropoff",
          routeId: 12,
          am: true,
          pm: false,
          weekdays: [],
        },
      ],
      { runDate: "2027-07-08", runPeriod: "am" },
    );

    expect(riders).toHaveLength(1);
    expect(riders[0]?.name).toBe("Parent Dropoff");
  });

  it("PT-only campers (no bus) do not appear on any bus roster", () => {
    const riders = parentTransportRidersForRoute(
      12,
      [
        {
          id: 4,
          name: "Car Only Kid",
          routeId: null,
          am: true,
          pm: true,
          weekdays: [],
        },
      ],
      { runDate: "2027-07-08", runPeriod: "am" },
    );

    expect(riders).toHaveLength(0);
    expect(isParentTransportBusAssigned({ routeId: null })).toBe(false);
    expect(parentTransportBusLabel({ routeId: null })).toBe(PARENT_TRANSPORT_NO_BUS_LABEL);
  });
});
