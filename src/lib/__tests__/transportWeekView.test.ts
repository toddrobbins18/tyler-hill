import { describe, expect, it } from "vitest";
import {
  applyEnrollmentWeekToRoutes,
  applySeasonRosterToRoutes,
  buildCamperEnrollmentLookup,
  camperEnrolledInWeekByLookup,
  filterUnplottedForWeek,
  filterUnplottedToSeasonRoster,
} from "@/lib/transportWeekView";
import { CAMP_LOCATION } from "@/lib/transportStopTimes";

describe("transportWeekView", () => {
  const lookup = buildCamperEnrollmentLookup([
    { name: "Enrolled Kid", enrolledWeeks: [2], session: null },
    { name: "Other Week", enrolledWeeks: [5], session: null },
  ]);

  it("removes prior-season ghost riders from map routes", () => {
    const roster = new Set(["enrolled kid"]);
    const routes = applySeasonRosterToRoutes(
      [
        {
          id: 1,
          name: "Bus 1",
          bus: "1",
          color: "#f00",
          direction: "Inbound",
          departure: "8:00",
          status: "Active",
          capacity: 40,
          campers: 2,
          stops: [
            {
              name: "Enrolled Kid",
              address: "1 Main St",
              lat: 40.8,
              lng: -73.7,
              pickupTime: "7:30",
              passengers: 1,
              camperNames: ["Enrolled Kid"],
            },
            {
              name: "2026 Ghost",
              address: "2 Oak Ave",
              lat: 40.81,
              lng: -73.71,
              pickupTime: "7:35",
              passengers: 1,
              camperNames: ["2026 Ghost"],
            },
          ],
        },
      ],
      roster,
    );
    expect(routes[0]?.stops).toHaveLength(1);
    expect(routes[0]?.stops[0]?.camperNames).toEqual(["Enrolled Kid"]);
  });

  it("filters unplotted list to current season roster", () => {
    const roster = new Set(["enrolled kid"]);
    const out = filterUnplottedToSeasonRoster(
      [
        { name: "Enrolled Kid" },
        { name: "2026 Only" },
      ],
      roster,
    );
    expect(out.map((c) => c.name)).toEqual(["Enrolled Kid"]);
  });

  it("removes non-enrolled riders from stops and drops empty stops from routes", () => {
    const routes = applyEnrollmentWeekToRoutes(
      [
        {
          id: 1,
          name: "Bus 1",
          bus: "1",
          color: "#f00",
          direction: "Inbound",
          departure: "8:00",
          status: "Active",
          capacity: 40,
          campers: 2,
          stops: [
            {
              name: "Enrolled Kid",
              address: "1 Main St",
              lat: 40.8,
              lng: -73.7,
              pickupTime: "7:30",
              passengers: 1,
              camperNames: ["Enrolled Kid"],
            },
            {
              name: "Other Week",
              address: "2 Oak Ave",
              lat: 40.81,
              lng: -73.71,
              pickupTime: "7:35",
              passengers: 1,
              camperNames: ["Other Week"],
            },
            {
              name: "Camp",
              address: CAMP_LOCATION.address,
              lat: 40.82,
              lng: -73.72,
              pickupTime: "8:00",
              passengers: 0,
            },
          ],
        },
      ],
      2,
      lookup,
    );

    expect(routes[0]?.stops).toHaveLength(2);
    expect(routes[0]?.stops[0]?.camperNames).toEqual(["Enrolled Kid"]);
    expect(routes[0]?.stops.some((s) => s.address === "2 Oak Ave")).toBe(false);
  });

  it("filters unplotted campers by enrollment week", () => {
    const campers = filterUnplottedForWeek(
      [
        { name: "Enrolled Kid", session: "" },
        { name: "Other Week", session: "" },
        { name: "Unknown", session: "" },
      ],
      2,
      lookup,
    );
    expect(campers.map((c) => c.name)).toEqual(["Enrolled Kid"]);
  });
});
