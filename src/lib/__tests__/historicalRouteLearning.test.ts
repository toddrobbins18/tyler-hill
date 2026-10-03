import { describe, expect, it } from "vitest";
import {
  applyHistoricalAssignments,
  buildPriorsFromBundledMappoint,
  buildRouteReferenceFromTransportBoard,
  getHistoricalRouteSuggestion,
  lookupCamperPrior,
  normCamperName,
  pickHistoricalBusForCamper,
  reorderStopsByHistoricalPriors,
} from "@/lib/historicalRouteLearning";
import { buildCamperPriorMap } from "@/lib/routeReferenceWarehouse";

describe("historicalRouteLearning", () => {
  const priors = buildPriorsFromBundledMappoint("2026");
  const priorMap = buildCamperPriorMap(priors);

  it("builds priors from bundled MapPoint", () => {
    expect(priors.length).toBeGreaterThan(300);
  });

  it("places camper on historical bus when route exists", () => {
    const samplePrior = priors[0];
    const result = applyHistoricalAssignments({
      coreStops: {
        [samplePrior.busNumber]: [
          {
            name: "Existing",
            address: samplePrior.address,
            lat: samplePrior.lat ?? 40.8,
            lng: samplePrior.lng ?? -73.6,
            pickupTime: "",
            passengers: 0,
            camperNames: [],
          },
        ],
      },
      routeMeta: [
        {
          id: samplePrior.busNumber,
          name: `Bus ${samplePrior.busNumber}`,
          bus: `Bus ${samplePrior.busNumber}`,
          departure: "7:00 AM",
          status: "Confirmed",
          color: "#000",
          capacity: 22,
        },
      ],
      unplottedCampers: [
        {
          id: 1,
          name: samplePrior.camperName,
          address: samplePrior.address,
          lat: samplePrior.lat ?? 40.8,
          lng: samplePrior.lng ?? -73.6,
          age: 10,
          session: "1st",
        },
      ],
      priorMap,
    });

    expect(result.placed.length).toBe(1);
    expect(result.unplottedCampers.length).toBe(0);
    expect(result.coreStops[samplePrior.busNumber][0].passengers).toBe(1);
  });

  it("returns route suggestion when prior bus is on the board", () => {
    const samplePrior = priors[0];
    const suggestion = getHistoricalRouteSuggestion(
      { name: samplePrior.camperName },
      priorMap,
      [{ id: samplePrior.busNumber, name: `Bus ${samplePrior.busNumber}`, bus: "", departure: "", status: "", color: "", capacity: 22 }],
    );
    expect(suggestion?.routeId).toBe(samplePrior.busNumber);
    expect(suggestion?.priorBusNumber).toBe(samplePrior.busNumber);
  });

  it("picks historical bus for camper", () => {
    const samplePrior = priors[0];
    const bus = pickHistoricalBusForCamper(
      {
        id: 1,
        name: samplePrior.camperName,
        address: samplePrior.address,
        lat: 40.8,
        lng: -73.6,
        age: 10,
        session: "",
      },
      priorMap,
      [{ id: samplePrior.busNumber, name: "", bus: "", departure: "", status: "", color: "", capacity: 22 }],
    );
    expect(bus).toBe(samplePrior.busNumber);
  });

  it("normalizes camper names consistently", () => {
    expect(normCamperName("  Jane Doe ")).toBe("jane doe");
  });

  it("matches expanded MapPoint sibling names to roster first/last", () => {
    const prior = lookupCamperPrior(priorMap, "Aaron Weissler", "AM");
    expect(prior?.busNumber).toBeGreaterThan(0);
    expect(prior?.referenceSeason).toBe("2026");
  });

  it("matches roster rows stored as Last, First", () => {
    const samplePrior = priors.find((p) => p.camperName.includes("Greene")) ?? priors[0];
    const [first, ...rest] = samplePrior.camperName.split(" ");
    const lastFirst = `${rest.join(" ")}, ${first}`;
    expect(lookupCamperPrior(priorMap, lastFirst, "AM")?.busNumber).toBe(samplePrior.busNumber);
  });

  it("does not treat empty template stops as learned camper priors", () => {
    const payload = buildRouteReferenceFromTransportBoard({
      referenceSeason: "2027",
      coreStops: {
        1: [
          {
            name: "2 Cambridge Ave",
            address: "2 Cambridge Ave, Port Washington, NY 11050",
            lat: 40.8,
            lng: -73.6,
            pickupTime: "",
            passengers: 0,
            camperNames: [],
          },
        ],
      },
      routeMeta: [
        {
          id: 1,
          name: "Manorhaven · Bus 1",
          bus: "Bus 1",
          departure: "7:00 AM",
          status: "Confirmed",
          color: "#000",
          capacity: 22,
        },
      ],
    });
    expect(payload.assignments.length).toBe(0);
  });

  it("places returning campers using bundled 2026 priors when roster uses first last", () => {
    const result = applyHistoricalAssignments({
      coreStops: { 28: [] },
      routeMeta: [
        {
          id: 28,
          name: "Flower Hill 2 · Bus 28",
          bus: "Bus 28",
          departure: "7:00 AM",
          status: "Confirmed",
          color: "#000",
          capacity: 22,
        },
      ],
      unplottedCampers: [
        {
          id: 1,
          name: "Aaron Weissler",
          address: "91 Remsen Ave, Roslyn, NY 11576",
          lat: 40.8,
          lng: -73.6,
          age: 8,
          session: "Full 8 Weeks",
        },
      ],
      priorMap,
    });

    expect(result.placed.length).toBe(1);
    expect(result.placed[0].busNumber).toBe(28);
  });

  it("reorders stops using historical stop order", () => {
    const sample = priors.filter((p) => p.busNumber === priors[0].busNumber).slice(0, 2);
    if (sample.length < 2) return;

    const [a, b] = sample.sort((x, y) => x.stopOrder - y.stopOrder);
    const coreStops = {
      [a.busNumber]: [
        {
          name: b.camperName,
          address: b.address,
          lat: 40.8,
          lng: -73.6,
          pickupTime: "",
          passengers: 1,
          camperNames: [b.camperName],
        },
        {
          name: a.camperName,
          address: a.address,
          lat: 40.81,
          lng: -73.61,
          pickupTime: "",
          passengers: 1,
          camperNames: [a.camperName],
        },
      ],
    };

    const reordered = reorderStopsByHistoricalPriors(coreStops, priorMap);
    const first = reordered[a.busNumber][0].camperNames?.[0];
    expect(first).toBe(a.camperName);
  });
});
