import { describe, expect, it } from "vitest";
import { getBundledMappointRoutesCsv2026 } from "@/lib/mappointTransportImport";
import {
  buildCamperPriorMap,
  buildReferenceRouteStops,
  buildRouteReferenceFromMappointCsv,
  normCamperNameKey,
  summarizeReferenceRoutes,
  validateWarehouseAgainstCsv,
} from "@/lib/routeReferenceWarehouse";

describe("routeReferenceWarehouse", () => {
  const csv = getBundledMappointRoutesCsv2026();
  const payload = buildRouteReferenceFromMappointCsv(csv, {
    referenceSeason: "2026",
    label: "Test import",
  });

  it("builds assignments from bundled MapPoint CSV", () => {
    expect(payload.assignments.length).toBeGreaterThan(300);
    expect(payload.stats.geocodedCount).toBeGreaterThan(200);
    expect(payload.stats.amAssignmentCount).toBeGreaterThan(0);
  });

  it("normalizes camper name keys", () => {
    expect(normCamperNameKey("  Jack & Lucas Fornatale ")).toBe("jack & lucas fornatale");
  });

  it("summarizes routes by bus and direction", () => {
    const routes = summarizeReferenceRoutes(payload.assignments);
    expect(routes.length).toBeGreaterThan(10);
    expect(routes[0].busNumber).toBeGreaterThan(0);
    expect(routes[0].camperCount).toBeGreaterThan(0);
  });

  it("builds ordered stops for a bus", () => {
    const firstBus = payload.assignments[0].busNumber;
    const stops = buildReferenceRouteStops(payload.assignments, firstBus, "AM");
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0].camperNames.length).toBeGreaterThan(0);
  });

  it("dedupes camper priors per direction", () => {
    const priors = payload.assignments.slice(0, 5).map((a) => ({
      camperName: a.camperName,
      camperNameKey: a.camperNameKey,
      referenceSeason: "2026",
      busNumber: a.busNumber,
      routeName: a.routeName,
      direction: a.direction,
      stopOrder: a.stopOrder,
      address: a.address,
      lat: a.lat,
      lng: a.lng,
      routeFile: a.routeFile,
    }));
    const map = buildCamperPriorMap([...priors, ...priors]);
    expect(map.size).toBe(priors.length);
  });

  it("validates against CSV parse counts", () => {
    const validation = validateWarehouseAgainstCsv(csv, payload);
    expect(validation.csvAssignmentCount).toBe(payload.stats.assignmentCount);
    expect(validation.geocodedPct).toBeGreaterThan(50);
  });
});
