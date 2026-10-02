import { describe, expect, it } from "vitest";
import { buildAMStops, isValidRouteCoordinate, parseDepartureToMinutes } from "@/lib/transportStopTimes";

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

  it("buildAMStops does not force uniform +2 minute jumps on short legs", () => {
    const stops = buildAMStops(
      [
        { name: "A", address: "a", lat: 40.88, lng: -73.64, pickupTime: "", passengers: 1 },
        { name: "B", address: "b", lat: 40.881, lng: -73.641, pickupTime: "", passengers: 1 },
        { name: "C", address: "c", lat: 40.885, lng: -73.645, pickupTime: "", passengers: 1 },
        { name: "D", address: "d", lat: 40.89, lng: -73.65, pickupTime: "", passengers: 1 },
      ],
      "7:00 AM",
    );

    const pickupTimes = stops.slice(0, 4).map((s) => s.pickupTime);
    expect(pickupTimes[0]).toBe("7:00 AM");
    const uniqueTimes = new Set(pickupTimes);
    expect(uniqueTimes.size).toBeGreaterThan(1);
    expect(pickupTimes.every((t) => t === "7:00 AM" || /^7:\d{2} AM$/.test(t))).toBe(true);
  });
});
