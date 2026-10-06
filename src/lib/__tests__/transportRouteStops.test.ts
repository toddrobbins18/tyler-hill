import { describe, expect, it } from "vitest";
import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";
import { consolidateRouteStopsByAddress, dedupeRidersAcrossRoute } from "@/lib/transportRouteStops";

describe("normalizeTransportAddress", () => {
  it("matches abbreviated and full street suffixes", () => {
    expect(normalizeTransportAddress("2 Sands Ln")).toBe("2 sands lane");
    expect(normalizeTransportAddress("2 Sands Lane, Manhasset, NY 11030")).toBe("2 sands lane");
  });

  it("ignores city and state when comparing addresses", () => {
    expect(normalizeTransportAddress("37 Sands Point Rd, Port Washington, NY")).toBe(
      normalizeTransportAddress("37 Sands Point Road"),
    );
  });
});

describe("consolidateRouteStopsByAddress", () => {
  it("merges template stop with camper stop at the same street", () => {
    const stops = [
      {
        name: "2 Sands Ln",
        address: "2 Sands Ln",
        lat: 40.83,
        lng: -73.7,
        pickupTime: "",
        passengers: 0,
        camperNames: [] as string[],
      },
      {
        name: "Jack Lovens +1",
        address: "2 Sands Lane, Manhasset, NY",
        lat: 40.8301,
        lng: -73.7001,
        pickupTime: "7:12 AM",
        passengers: 2,
        camperNames: ["Jack Lovens", "Noa Lovens"],
      },
    ];

    const merged = consolidateRouteStopsByAddress(stops);
    expect(merged).toHaveLength(1);
    expect(merged[0].camperNames).toEqual(["Jack Lovens", "Noa Lovens"]);
    expect(merged[0].passengers).toBe(2);
  });

  it("keeps distinct unit numbers separate", () => {
    const stops = [
      {
        name: "2 Cambridge Ave",
        address: "2 Cambridge Ave, Port Washington, NY",
        lat: 40.84,
        lng: -73.71,
        pickupTime: "",
        passengers: 0,
        camperNames: [] as string[],
      },
      {
        name: "Ava Greene",
        address: "2b Cambridge Avenue, Port Washington, NY",
        lat: 40.8402,
        lng: -73.7102,
        pickupTime: "7:15 AM",
        passengers: 1,
        camperNames: ["Ava Greene"],
      },
    ];

    const merged = consolidateRouteStopsByAddress(stops);
    expect(merged).toHaveLength(2);
  });

  it("does not merge different streets that share the same bad geocode", () => {
    const sharedLat = 40.84;
    const sharedLng = -73.71;
    const stops = [
      {
        name: "Alex Rubel",
        address: "34 Dunes Ln, Port Washington, NY",
        lat: sharedLat,
        lng: sharedLng,
        pickupTime: "7:00 AM",
        passengers: 1,
        camperNames: ["Alex Rubel"],
      },
      {
        name: "26 Cove Dr",
        address: "26 Cove Dr, Port Washington, NY",
        lat: sharedLat,
        lng: sharedLng,
        pickupTime: "",
        passengers: 0,
        camperNames: [] as string[],
      },
      {
        name: "Audrey Anteby",
        address: "26 Cove Dr, Port Washington, NY",
        lat: sharedLat,
        lng: sharedLng,
        pickupTime: "7:05 AM",
        passengers: 1,
        camperNames: ["Audrey Anteby"],
      },
    ];

    const merged = consolidateRouteStopsByAddress(stops);
    expect(merged).toHaveLength(2);
    expect(merged.some((s) => s.camperNames?.includes("Alex Rubel"))).toBe(true);
    expect(merged.some((s) => s.camperNames?.includes("Audrey Anteby"))).toBe(true);
  });

  it("dedupeRidersAcrossRoute keeps each camper on one stop only", () => {
    const stops = [
      {
        name: "Stop A",
        address: "10 Main St",
        lat: 40.84,
        lng: -73.71,
        pickupTime: "7:00 AM",
        passengers: 1,
        camperNames: ["Sam Cohen"],
      },
      {
        name: "Stop B",
        address: "20 Oak Ave",
        lat: 40.85,
        lng: -73.72,
        pickupTime: "7:05 AM",
        passengers: 1,
        camperNames: ["Sam Cohen"],
      },
    ];
    const deduped = dedupeRidersAcrossRoute(stops);
    const allNames = deduped.flatMap((s) => s.camperNames ?? []);
    expect(allNames.filter((n) => n === "Sam Cohen")).toHaveLength(1);
    expect(deduped[0].camperNames).toContain("Sam Cohen");
    expect(deduped[1].camperNames ?? []).not.toContain("Sam Cohen");
  });
});
