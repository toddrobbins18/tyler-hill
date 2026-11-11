import { describe, expect, it } from "vitest";
import {
  assignStopTimesFromLegMinutes,
  buildAMStops,
  CAMP_LOCATION,
  DEFAULT_STOP_DWELL_MINUTES,
  estimateDrivingLegMinutes,
  isValidRouteCoordinate,
  parseDepartureToMinutes,
} from "@/lib/transportStopTimes";

describe("transportStopTimes", () => {
  it("parseDepartureToMinutes handles AM/PM", () => {
    expect(parseDepartureToMinutes("7:00 AM")).toBe(7 * 60);
    expect(parseDepartureToMinutes("TBD")).toBeNull();
  });

  it("isValidRouteCoordinate rejects null island", () => {
    expect(isValidRouteCoordinate(0, 0)).toBe(false);
    expect(isValidRouteCoordinate(40.88, -73.64)).toBe(true);
  });

  it("buildAMStops ignores invalid coordinates when estimating leg times", () => {
    const stops = buildAMStops(
      [{ name: "Bad", address: "", lat: 0, lng: 0, pickupTime: "", passengers: 1 }],
      null,
    );
    const campStop = stops[stops.length - 1];
    expect(campStop.pickupTime).not.toMatch(/180\d{2}/);
  });

  it("buildAMStops adds dwell time so nearby stops do not share the same clock time", () => {
    const lat = 40.88;
    const lng = -73.64;
    const stops = buildAMStops(
      [
        { name: "A", address: "a", lat, lng, pickupTime: "", passengers: 1 },
        { name: "B", address: "b", lat, lng, pickupTime: "", passengers: 1 },
        { name: "C", address: "c", lat, lng, pickupTime: "", passengers: 1 },
        { name: "D", address: "d", lat, lng, pickupTime: "", passengers: 1 },
      ],
      "7:00 AM",
    );

    const pickupTimes = stops.slice(0, 4).map((s) => s.pickupTime);
    expect(pickupTimes[0]).toBe("7:00 AM");
    expect(pickupTimes[1]).toBe(`7:0${DEFAULT_STOP_DWELL_MINUTES} AM`);
    const uniqueTimes = new Set(pickupTimes);
    expect(uniqueTimes.size).toBe(4);
  });

  it("estimates Port Washington to camp as about a half hour, not 12 minutes", () => {
    const minutes = estimateDrivingLegMinutes(40.821, -73.698, CAMP_LOCATION.lat, CAMP_LOCATION.lng);
    expect(minutes).toBeGreaterThan(22);
    expect(minutes).toBeLessThan(40);
  });

  it("assignStopTimesFromLegMinutes uses provided leg durations", () => {
    const timed = assignStopTimesFromLegMinutes(
      [
        { name: "A", address: "a", lat: 0, lng: 0, pickupTime: "", passengers: 1 },
        { name: "B", address: "b", lat: 0, lng: 0, pickupTime: "", passengers: 1 },
      ],
      "8:00 AM",
      [15],
    );
    expect(timed[0].pickupTime).toBe("8:00 AM");
    expect(timed[1].pickupTime).toBe("8:17 AM");
  });

  it("does not treat Manorhaven to camp as a 2-minute last leg", () => {
    const lastHouse = {
      name: "Emerson Sabbag",
      address: "96 Barkers Point Rd, Port Washington, NY 11050",
      lat: 40.8425801,
      lng: -73.7264324,
      pickupTime: "",
      passengers: 1,
      camperNames: ["Emerson Sabbag"],
    };
    const timed = buildAMStops([lastHouse], "8:00 AM", { legMinutes: [1] });
    const camp = timed[timed.length - 1];
    expect(timed[0]?.pickupTime).toBe("8:00 AM");
    expect(camp?.pickupTime).not.toMatch(/^8:0[0-5] AM$/);
    const campMinutes = parseDepartureToMinutes(camp?.pickupTime);
    const lastMinutes = parseDepartureToMinutes(timed[0]?.pickupTime);
    expect(campMinutes).not.toBeNull();
    expect(lastMinutes).not.toBeNull();
    expect((campMinutes ?? 0) - (lastMinutes ?? 0)).toBeGreaterThan(15);
  });

  it("does not add passenger dwell after a counselor pickup", () => {
    const timed = assignStopTimesFromLegMinutes(
      [
        { name: "Counselor", address: "staff", lat: 40.86, lng: -73.63, pickupTime: "", passengers: 0, stopRole: "counselor" },
        { name: "Kid", address: "kid", lat: 40.87, lng: -73.64, pickupTime: "", passengers: 1 },
      ],
      "7:00 AM",
      [10],
    );
    expect(timed[0].pickupTime).toBe("7:00 AM");
    expect(timed[1].pickupTime).toBe("7:10 AM");
  });
});
