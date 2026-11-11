import { describe, expect, it } from "vitest";
import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";
import {
  consolidateRouteStopsByAddress,
  dedupeRidersAcrossRoute,
  insertStopAlongRoute,
  mergeCampersIntoStops,
} from "@/lib/transportRouteStops";

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

describe("mergeCampersIntoStops", () => {
  const stop = (
    name: string,
    address: string,
    extra?: { lat?: number; lng?: number; camperNames?: string[] },
  ) => ({
    name,
    address,
    lat: extra?.lat ?? 40.84,
    lng: extra?.lng ?? -73.71,
    pickupTime: "TBD",
    passengers: extra?.camperNames?.length ?? 1,
    camperNames: extra?.camperNames ?? [name],
  });

  it("keeps circled campers on different streets as separate stops", () => {
    const { next } = mergeCampersIntoStops(
      [stop("Existing Kid", "1 Main St, Port Washington, NY")],
      [
        { name: "Ava Chen", address: "10 Soundview Dr, Port Washington, NY", lat: 40.85, lng: -73.71 },
        { name: "Ben Ross", address: "22 Cambridge Ave, Port Washington, NY", lat: 40.84, lng: -73.7 },
        { name: "Cara Diaz", address: "8 Cedar Ln, Port Washington, NY", lat: 40.841, lng: -73.72 },
      ],
    );

    expect(next).toHaveLength(4);
    const names = next.flatMap((s) => s.camperNames ?? []);
    expect(names).toEqual(expect.arrayContaining(["Existing Kid", "Ava Chen", "Ben Ross", "Cara Diaz"]));
    expect(new Set(names).size).toBe(4);
  });

  it("adds a second circle of houses as new stops, not one clump at the end", () => {
    const first = mergeCampersIntoStops([], [
      { name: "Ava Chen", address: "10 Soundview Dr, Port Washington, NY", lat: 40.85, lng: -73.71 },
      { name: "Ben Ross", address: "22 Cambridge Ave, Port Washington, NY", lat: 40.843, lng: -73.71 },
    ]);
    expect(first.next).toHaveLength(2);

    const second = mergeCampersIntoStops(first.next, [
      { name: "Cara Diaz", address: "8 Cedar Ln, Port Washington, NY", lat: 40.841, lng: -73.722 },
      { name: "Drew Kim", address: "3 Driftwood Dr, Port Washington, NY", lat: 40.84, lng: -73.72 },
    ]);
    expect(second.next).toHaveLength(4);
    expect(second.next.every((s) => (s.camperNames?.length ?? 0) === 1)).toBe(true);
  });

  it("slots a new house into the route instead of making it the last stop before camp", () => {
    const nearCamp = stop("Near camp", "1 Crescent Beach Rd, Glen Cove, NY", {
      lat: 40.879,
      lng: -73.643,
    });
    const farHouse = {
      name: "Manorhaven",
      address: "96 Barkers Point Rd, Port Washington, NY",
      lat: 40.84258,
      lng: -73.72643,
      pickupTime: "TBD",
      passengers: 1,
      camperNames: ["Manorhaven"],
    };
    const ordered = insertStopAlongRoute([nearCamp], farHouse);
    expect(ordered).toHaveLength(2);
    expect(ordered[0]?.name).toBe("Manorhaven");
    expect(ordered[1]?.name).toBe("Near camp");
  });

  it("still groups siblings who live at the same house", () => {
    const { next } = mergeCampersIntoStops([], [
      { name: "Jack Lovens", address: "2 Sands Ln, Manhasset, NY", lat: 40.83, lng: -73.7 },
      { name: "Noa Lovens", address: "2 Sands Lane, Manhasset, NY 11030", lat: 40.83, lng: -73.7 },
    ]);

    expect(next).toHaveLength(1);
    expect(next[0]?.camperNames).toEqual(["Jack Lovens", "Noa Lovens"]);
    expect(next[0]?.passengers).toBe(2);
  });

  it("adds a sibling onto an existing stop without swallowing other circled houses", () => {
    const { next } = mergeCampersIntoStops(
      [stop("Jack Lovens", "2 Sands Ln, Manhasset, NY", { camperNames: ["Jack Lovens"] })],
      [
        { name: "Noa Lovens", address: "2 Sands Lane, Manhasset, NY", lat: 40.83, lng: -73.7 },
        { name: "Ava Chen", address: "10 Soundview Dr, Port Washington, NY", lat: 40.85, lng: -73.71 },
      ],
    );

    expect(next).toHaveLength(2);
    const sands = next.find((s) => s.camperNames?.includes("Jack Lovens"));
    const soundview = next.find((s) => s.camperNames?.includes("Ava Chen"));
    expect(sands?.camperNames).toEqual(["Jack Lovens", "Noa Lovens"]);
    expect(soundview?.camperNames).toEqual(["Ava Chen"]);
  });
});
