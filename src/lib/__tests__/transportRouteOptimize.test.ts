import { describe, expect, it } from "vitest";
import { optimizeStopsFromFirstStop, optimizeStopsWithPinned } from "@/lib/transportRouteOptimize";
import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";

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

  it("keeps pinned pickups in place and optimizes segments between them", () => {
    const stops = [
      { name: "Pinned A", address: "a", lat: 40.88, lng: -73.64, pickupTime: "", passengers: 1 },
      { name: "Mid Far", address: "b", lat: 40.95, lng: -73.70, pickupTime: "", passengers: 1 },
      { name: "Mid Near", address: "c", lat: 40.881, lng: -73.641, pickupTime: "", passengers: 1 },
      { name: "Pinned D", address: "d", lat: 40.90, lng: -73.65, pickupTime: "", passengers: 1 },
      { name: "Tail Far", address: "e", lat: 40.99, lng: -73.71, pickupTime: "", passengers: 1 },
      { name: "Tail Near", address: "f", lat: 40.901, lng: -73.651, pickupTime: "", passengers: 1 },
    ];
    const ordered = optimizeStopsWithPinned(stops, [
      normalizeTransportAddress("a"),
      normalizeTransportAddress("d"),
    ]);
    expect(ordered.map((s) => s.name)).toEqual(["Pinned A", "Mid Near", "Mid Far", "Pinned D", "Tail Near", "Tail Far"]);
  });
});
