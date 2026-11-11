import { describe, expect, it } from "vitest";
import { campersInsideLasso, pointInPolygon } from "@/lib/transportMapLasso";

const square = [
  { lat: 40.8, lng: -73.7 },
  { lat: 40.8, lng: -73.6 },
  { lat: 40.9, lng: -73.6 },
  { lat: 40.9, lng: -73.7 },
];

describe("transportMapLasso", () => {
  it("detects points inside a drawn loop", () => {
    expect(pointInPolygon({ lat: 40.85, lng: -73.65 }, square)).toBe(true);
    expect(pointInPolygon({ lat: 40.7, lng: -73.65 }, square)).toBe(false);
  });

  it("selects campers circled on the map", () => {
    const campers = [
      { id: 1, lat: 40.85, lng: -73.65 },
      { id: 2, lat: 40.85, lng: -73.65 },
      { id: 3, lat: 41.0, lng: -73.65 },
    ];
    expect(campersInsideLasso(campers, square).map((c) => c.id)).toEqual([1, 2]);
  });
});
