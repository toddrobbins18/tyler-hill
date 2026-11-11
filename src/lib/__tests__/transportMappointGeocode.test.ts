import { describe, expect, it } from "vitest";
import {
  canonicalizeGeocodeKey,
  resolveBundledGeocodeResult,
  snapToBundledGeocode,
} from "@/lib/mappointTransportImport";
import { buildUnplottedFromEnrollment } from "@/lib/transportRoster";

describe("bundled MapPoint geocode", () => {
  it("treats Drive as Dr", () => {
    expect(canonicalizeGeocodeKey("121 Soundview Drive, Port Washington, NY 11050")).toBe(
      "121 soundview dr, port washington, ny 11050",
    );
  });

  it("places 121 Soundview Drive on the Port Washington street, not the bay", () => {
    const pin = resolveBundledGeocodeResult("121 Soundview Drive, Port Washington, NY 11050");
    expect(pin).not.toBeNull();
    expect(pin!.lat).toBeGreaterThan(40.846);
    expect(pin!.lat).toBeLessThan(40.851);
    expect(pin!.lng).toBeGreaterThan(-73.704);
    expect(pin!.lng).toBeLessThan(-73.699);
  });

  it("snaps a water pin back to Soundview Dr", () => {
    const snapped = snapToBundledGeocode(
      "121 Soundview Drive, Port Washington, NY 11050",
      40.83,
      -73.69,
    );
    expect(snapped.lat).toBeGreaterThan(40.846);
    expect(snapped.lng).toBeLessThan(-73.699);
  });

  it("keeps a pin that is already on the street", () => {
    const onStreet = resolveBundledGeocodeResult("111 Soundview Dr, Port Washington, NY 11050")!;
    const snapped = snapToBundledGeocode(
      "111 Soundview Dr, Port Washington, NY 11050",
      onStreet.lat,
      onStreet.lng,
    );
    expect(snapped.lat).toBeCloseTo(onStreet.lat, 6);
    expect(snapped.lng).toBeCloseTo(onStreet.lng, 6);
  });

  it("moves Jacob Bruno off a saved bay coordinate when the board rebuilds", () => {
    const rebuilt = buildUnplottedFromEnrollment({
      enrolled: [
        {
          id: "1",
          personId: "22032198",
          name: "Jacob Bruno",
          age: 3,
          session: "Full 8 Weeks",
          grade: "K",
          groupName: null,
          homeAddress: "121 Soundview Drive, Port Washington, NY 11050",
        },
      ],
      coreStops: {},
      existingUnplotted: [
        {
          id: 9,
          name: "Jacob Bruno",
          address: "121 Soundview Drive, Port Washington, NY 11050",
          lat: 40.83,
          lng: -73.69,
          age: 3,
          session: "Full 8 Weeks",
        },
      ],
    });
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0]?.lat).toBeGreaterThan(40.846);
    expect(rebuilt[0]?.lng).toBeLessThan(-73.699);
  });
});
