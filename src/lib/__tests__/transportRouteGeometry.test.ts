import { describe, expect, it } from "vitest";
import { mergeRoadLegGeometries, routeGeometryCacheKey } from "@/lib/transportRouteGeometry";

describe("transportRouteGeometry", () => {
  it("builds stable cache keys from coordinates", () => {
    const key = routeGeometryCacheKey([
      [-73.64, 40.88],
      [-73.65, 40.89],
    ]);
    expect(key).toBe("-73.64000,40.88000|-73.65000,40.89000");
  });

  it("merges leg geometries without duplicating join points", () => {
    const merged = mergeRoadLegGeometries([
      [
        [40.88, -73.64],
        [40.881, -73.641],
        [40.882, -73.642],
      ],
      [
        [40.882, -73.642],
        [40.883, -73.643],
      ],
    ]);

    expect(merged).toEqual([
      [40.88, -73.64],
      [40.881, -73.641],
      [40.882, -73.642],
      [40.883, -73.643],
    ]);
  });
});
