/**
 * Smoke tests for transport route optimization — Todd's duplicate-open-stop scenario.
 */
import { describe, expect, it } from "vitest";
import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";
import { optimizeStopsFromFirstStop, optimizeStopsWithPinned } from "@/lib/transportRouteOptimize";
import { consolidateRouteStopsByAddress } from "@/lib/transportRouteStops";
import { routeStopListLines } from "@/lib/transportStopTimes";

const bus2BeforeOptimize = [
  {
    name: "Jack Lovens +1",
    address: "2 Sands Lane, Manhasset, NY",
    lat: 40.83,
    lng: -73.7,
    pickupTime: "7:05 AM",
    passengers: 2,
    camperNames: ["Jack Lovens", "Noa Lovens"],
  },
  {
    name: "2 Sands Ln",
    address: "2 Sands Ln",
    lat: 40.83005,
    lng: -73.70005,
    pickupTime: "",
    passengers: 0,
    camperNames: [] as string[],
  },
  {
    name: "Ryan Cannon",
    address: "14 Soundview Ave, Manhasset, NY",
    lat: 40.831,
    lng: -73.701,
    pickupTime: "7:10 AM",
    passengers: 1,
    camperNames: ["Ryan Cannon"],
  },
];

describe("transport optimize smoke", () => {
  it("Bus 2: merges orphan template stop onto camper stop (2 Sands Ln vs 2 Sands Lane)", () => {
    const merged = consolidateRouteStopsByAddress(bus2BeforeOptimize);
    expect(merged).toHaveLength(2);

    const sandsStop = merged.find((s) => normalizeTransportAddress(s.address).includes("sands"));
    expect(sandsStop?.camperNames).toEqual(["Jack Lovens", "Noa Lovens"]);
    expect(sandsStop?.passengers).toBe(2);

    const lines = routeStopListLines(sandsStop!, { isCamp: false });
    expect(lines.title).toBe("Jack Lovens, Noa Lovens");
    expect(lines.subtitle).toContain("Sands");
    expect(lines.isOpenStop).toBe(false);
    expect(lines.subtitle).not.toContain("Open stop");
  });

  it("Bus 1: keeps 2 vs 2b Cambridge as separate stops", () => {
    const bus1Stops = [
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
    const merged = consolidateRouteStopsByAddress(bus1Stops);
    expect(merged).toHaveLength(2);

    const ava = merged.find((s) => s.camperNames?.includes("Ava Greene"));
    expect(routeStopListLines(ava!, { isCamp: false }).title).toBe("Ava Greene");

    const open = merged.find((s) => s.camperNames?.length === 0);
    expect(routeStopListLines(open!, { isCamp: false }).subtitle).toContain("Open stop");
  });

  it("optimize from first stop preserves stop #1 and keeps all camper names", () => {
    const consolidated = consolidateRouteStopsByAddress(bus2BeforeOptimize);
    const optimized = optimizeStopsFromFirstStop(consolidated);

    expect(optimized[0].camperNames).toEqual(["Jack Lovens", "Noa Lovens"]);
    expect(optimized.every((s) => s.camperNames?.length !== 0 || s.address.includes("Sands") === false)).toBe(true);

    const allNames = optimized.flatMap((s) => s.camperNames ?? []);
    expect(allNames).toContain("Jack Lovens");
    expect(allNames).toContain("Noa Lovens");
    expect(allNames).toContain("Ryan Cannon");
  });

  it("pinned stop optimize keeps pinned address first", () => {
    const consolidated = consolidateRouteStopsByAddress(bus2BeforeOptimize);
    const pinKey = normalizeTransportAddress("2 Sands Lane, Manhasset, NY");
    const optimized = optimizeStopsWithPinned(consolidated, [pinKey]);

    expect(normalizeTransportAddress(optimized[0].address)).toBe(pinKey);
    expect(optimized[0].camperNames).toEqual(["Jack Lovens", "Noa Lovens"]);
  });

  it("simulated ORS output: template job + camper job at same street becomes one named stop", () => {
    // Mirrors handleOptimizeRoutes ORS mapping + consolidateRouteStopsByAddress
    const orsOrdered = [
      { name: "2 Sands Ln", address: "2 Sands Ln", lat: 40.83, lng: -73.7, pickupTime: "", passengers: 0, camperNames: [] as string[] },
      { name: "Jack Lovens", address: "2 Sands Lane, Manhasset, NY", lat: 40.8301, lng: -73.7001, pickupTime: "TBD", passengers: 1, camperNames: ["Jack Lovens"] },
      { name: "Noa Lovens", address: "2 Sands Lane, Manhasset, NY", lat: 40.8301, lng: -73.7001, pickupTime: "TBD", passengers: 1, camperNames: ["Noa Lovens"] },
    ];
    const afterApply = consolidateRouteStopsByAddress(orsOrdered);
    expect(afterApply).toHaveLength(1);
    expect(afterApply[0].camperNames?.sort()).toEqual(["Jack Lovens", "Noa Lovens"].sort());
    expect(routeStopListLines(afterApply[0], { isCamp: false }).isOpenStop).toBe(false);
  });
});
