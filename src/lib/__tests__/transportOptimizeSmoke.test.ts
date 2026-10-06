/**
 * Smoke tests for transport route optimization — Todd's duplicate-open-stop scenario.
 */
import { describe, expect, it } from "vitest";
import { applyHistoricalAssignments, buildPriorsFromBundledMappoint } from "@/lib/historicalRouteLearning";
import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";
import { buildCamperPriorMap } from "@/lib/routeReferenceWarehouse";
import { optimizeStopsFromFirstStop, optimizeStopsWithPinned } from "@/lib/transportRouteOptimize";
import { consolidateRouteStopsByAddress, sanitizeRouteStops } from "@/lib/transportRouteStops";
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

  it("pinned stop optimize keeps pinned address in route order", () => {
    const consolidated = consolidateRouteStopsByAddress(bus2BeforeOptimize);
    const pinKey = normalizeTransportAddress("2 Sands Lane, Manhasset, NY");
    const optimized = optimizeStopsWithPinned(consolidated, [pinKey]);

    expect(normalizeTransportAddress(optimized[0].address)).toBe(pinKey);
    expect(optimized[0].camperNames).toEqual(["Jack Lovens", "Noa Lovens"]);
  });

  it("prior placement uses historical stop order when address text differs", () => {
    const priors = buildPriorsFromBundledMappoint("2026");
    const priorMap = buildCamperPriorMap(priors);
    const sample = priors.find((p) => p.busNumber === 1 && p.stopOrder > 1);
    expect(sample).toBeTruthy();

    const result = applyHistoricalAssignments({
      coreStops: {
        1: [
          {
            name: "2 Cambridge Ave",
            address: "2 Cambridge Ave, Port Washington, NY",
            lat: 40.84,
            lng: -73.71,
            pickupTime: "",
            passengers: 0,
            camperNames: [],
          },
          {
            name: sample!.address.split(",")[0],
            address: sample!.address,
            lat: sample!.lat ?? 40.841,
            lng: sample!.lng ?? -73.711,
            pickupTime: "",
            passengers: 0,
            camperNames: [],
          },
        ],
      },
      routeMeta: [{ id: 1, name: "Bus 1", bus: "Bus 1" }],
      unplottedCampers: [
        {
          id: 100,
          name: sample!.camperName,
          address: "Different formatting 999 Nowhere Rd",
          lat: 0,
          lng: 0,
          age: 10,
          session: "1st",
        },
      ],
      priorMap,
    });

    expect(result.placed.length).toBe(1);
    expect(result.coreStops[1][sample!.stopOrder - 1].camperNames).toContain(sample!.camperName);
  });

  it("prior placement assigns to template stop without camper coordinates", () => {
    const priors = buildPriorsFromBundledMappoint("2026");
    const priorMap = buildCamperPriorMap(priors);
    const sample = priors.find((p) => p.busNumber === 6 && p.address);
    expect(sample).toBeTruthy();

    const result = applyHistoricalAssignments({
      coreStops: {
        [sample!.busNumber]: [
          {
            name: sample!.address.split(",")[0],
            address: sample!.address,
            lat: sample!.lat ?? 40.83,
            lng: sample!.lng ?? -73.7,
            pickupTime: "",
            passengers: 0,
            camperNames: [],
          },
        ],
      },
      routeMeta: [{ id: sample!.busNumber, name: "Bus 6", bus: "Bus 6" }],
      unplottedCampers: [
        {
          id: 99,
          name: sample!.camperName,
          address: sample!.address,
          lat: 0,
          lng: 0,
          age: 10,
          session: "1st",
        },
      ],
      priorMap,
    });

    expect(result.placed.length).toBe(1);
    expect(result.coreStops[sample!.busNumber][0].camperNames).toContain(sample!.camperName);
  });

  it("simulated ORS output: template job + camper job at same street becomes one named stop", () => {
    // Mirrors handleOptimizeRoutes post-reorder sanitize (Todd Bus 2 / Bus 3 duplicate scenario)
    const orsOrdered = [
      { name: "2 Sands Ln", address: "2 Sands Ln", lat: 40.83, lng: -73.7, pickupTime: "", passengers: 0, camperNames: [] as string[] },
      { name: "Jack Lovens", address: "2 Sands Lane, Manhasset, NY", lat: 40.8301, lng: -73.7001, pickupTime: "TBD", passengers: 1, camperNames: ["Jack Lovens"] },
      { name: "Noa Lovens", address: "2 Sands Lane, Manhasset, NY", lat: 40.8301, lng: -73.7001, pickupTime: "TBD", passengers: 1, camperNames: ["Noa Lovens"] },
    ];
    const afterApply = sanitizeRouteStops(orsOrdered);
    expect(afterApply).toHaveLength(1);
    expect(afterApply[0].camperNames?.sort()).toEqual(["Jack Lovens", "Noa Lovens"].sort());
    expect(routeStopListLines(afterApply[0], { isCamp: false }).isOpenStop).toBe(false);
  });

  it("Bus 3 style: open template stop + plotted camper at same street — no duplicate names after sanitize", () => {
    const bus3 = [
      {
        name: "15 Harbor Rd",
        address: "15 Harbor Rd",
        lat: 40.8,
        lng: -73.6,
        pickupTime: "",
        passengers: 0,
        camperNames: [] as string[],
      },
      {
        name: "Sam Cohen",
        address: "15 Harbor Road, Roslyn, NY",
        lat: 40.8001,
        lng: -73.6001,
        pickupTime: "7:05 AM",
        passengers: 1,
        camperNames: ["Sam Cohen"],
      },
    ];
    const afterOptimize = sanitizeRouteStops(bus3);
    expect(afterOptimize).toHaveLength(1);
    expect(afterOptimize[0].camperNames).toEqual(["Sam Cohen"]);
    const allNames = afterOptimize.flatMap((s) => s.camperNames ?? []);
    expect(allNames.filter((n) => n === "Sam Cohen")).toHaveLength(1);
    expect(routeStopListLines(afterOptimize[0], { isCamp: false }).title).toBe("Sam Cohen");
  });

  it("removes duplicate camper name if listed on two stops on same bus", () => {
    const bus3 = [
      {
        name: "Sam Cohen",
        address: "15 Harbor Rd, Roslyn, NY",
        lat: 40.8,
        lng: -73.6,
        pickupTime: "7:05 AM",
        passengers: 1,
        camperNames: ["Sam Cohen"],
      },
      {
        name: "15 Harbor Rd",
        address: "15 Harbor Road, Roslyn, NY",
        lat: 40.8001,
        lng: -73.6001,
        pickupTime: "",
        passengers: 1,
        camperNames: ["Sam Cohen"],
      },
    ];
    const deduped = sanitizeRouteStops(bus3);
    const allNames = deduped.flatMap((s) => s.camperNames ?? []);
    expect(allNames.filter((n) => n === "Sam Cohen")).toHaveLength(1);
    expect(deduped).toHaveLength(1);
  });
});
