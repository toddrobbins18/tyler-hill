import { describe, expect, it } from "vitest";
import {
  buildBusBubbleSheetRoutes,
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
