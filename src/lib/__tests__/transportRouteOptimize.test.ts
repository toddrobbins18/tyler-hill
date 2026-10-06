import { describe, expect, it } from "vitest";
import { optimizeStopsFromFirstStop } from "@/lib/transportRouteOptimize";

describe("transportRouteOptimize", () => {
  it("keeps the first stop fixed and reorders the rest", () => {
    const stops = [
      { name: "First", address: "a", lat: 40.88, lng: -73.64, pickupTime: "", passengers: 1 },
      { name: "Far", address: "b", lat: 40.95, lng: -73.70, pickupTime: "", passengers: 1 },
      { name: "Near", address: "c", lat: 40.881, lng: -73.641, pickupTime: "", passengers: 1 },
    ];
    const ordered = optimizeStopsFromFirstStop(stops);
    expect(ordered[0].name).toBe("First");
    expect(ordered[1].name).toBe("Near");
    expect(ordered[2].name).toBe("Far");
  });
});
