import { describe, expect, it } from "vitest";
import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";
import { consolidateRouteStopsByAddress } from "@/lib/transportRouteStops";

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
});
