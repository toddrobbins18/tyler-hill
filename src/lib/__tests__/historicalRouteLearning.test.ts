import { describe, expect, it } from "vitest";
import {
  applyHistoricalAssignments,
  buildPriorsFromBundledMappoint,
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
