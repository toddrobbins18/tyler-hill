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

  it("shortens street directionals but leaves city names alone", () => {
    expect(canonicalizeGeocodeKey("26 South George St, Roslyn Heights, NY 11577")).toBe(
      "26 s george st, roslyn heights, ny 11577",
    );
    expect(canonicalizeGeocodeKey("11 Walnut Ave, East Norwich, NY 11732")).toBe(
      "11 walnut ave, east norwich, ny 11732",
    );
  });

  it("strips apartment tokens so 92a #79 still parses as house 92", () => {
    expect(canonicalizeGeocodeKey("92a Glenwood Rd #79, Sea Cliff, NY 11579")).toBe(
      "92a glenwood rd, sea cliff, ny 11579",
    );
  });

  it("drops floor fragments so Marwood stays Port Washington", () => {
    expect(canonicalizeGeocodeKey("39 Marwood Rd N, Fl 1, Port Washington, NY 11050")).toBe(
      "39 marwood rd n, port washington, ny 11050",
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

  it("replaces a slightly drifted saved pin with the MapPoint house", () => {
    const onStreet = resolveBundledGeocodeResult("111 Soundview Dr, Port Washington, NY 11050")!;
    const snapped = snapToBundledGeocode(
      "111 Soundview Dr, Port Washington, NY 11050",
      onStreet.lat + 0.001,
      onStreet.lng - 0.001,
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

  it("pins 45 Soundview Drive on the Port Washington street, not Glen Head", () => {
    const known = resolveBundledGeocodeResult("67 Soundview Dr, Port Washington, NY 11050");
    const pin = resolveBundledGeocodeResult("45 Soundview Drive, Port Washington, NY 11050");
    expect(known).not.toBeNull();
    expect(pin).not.toBeNull();
    expect(Math.abs(pin!.lat - known!.lat)).toBeLessThan(0.012);
    expect(Math.abs(pin!.lng - known!.lng)).toBeLessThan(0.012);
    expect(pin!.lng).toBeLessThan(-73.69);
  });

  it("pins 184 Circle Drive on the Manhasset street", () => {
    const known = resolveBundledGeocodeResult("289 Circle Dr, Manhasset, NY 11030");
    const pin = resolveBundledGeocodeResult("184 Circle Drive, Manhasset, NY 11030");
    expect(known).not.toBeNull();
    expect(pin).not.toBeNull();
    expect(Math.abs(pin!.lat - known!.lat)).toBeLessThan(0.02);
    expect(Math.abs(pin!.lng - known!.lng)).toBeLessThan(0.02);
  });

  it("matches 26 George Street to MapPoint 26 S George St", () => {
    const south = resolveBundledGeocodeResult("26 S George St, Roslyn Heights, NY 11577");
    const omitted = resolveBundledGeocodeResult("26 George Street, Roslyn heights, NY 11577");
    expect(south).not.toBeNull();
    expect(omitted).not.toBeNull();
    expect(omitted!.lat).toBeCloseTo(south!.lat, 6);
    expect(omitted!.lng).toBeCloseTo(south!.lng, 6);
  });

  it("pins 37B Hickory and 70A Sagamore on the MapPoint street", () => {
    const hickory = resolveBundledGeocodeResult("37B Hickory Road, Sands Point, NY 11050");
    const sagamore = resolveBundledGeocodeResult("70A Sagamore Hill Drive, Port Washington, NY 11050");
    expect(hickory).not.toBeNull();
    expect(sagamore).not.toBeNull();
    expect(hickory!.lng).toBeLessThan(-73.69);
    expect(sagamore!.lng).toBeLessThan(-73.69);
  });

  it("pins houses past the last MapPoint stop on the same road", () => {
    const barBeach = resolveBundledGeocodeResult("90 Bar Beach Road, Port Washington, NY 11050");
    const driftwood = resolveBundledGeocodeResult("65 Driftwood Drive, Port Washington, NY 11050");
    const bayview = resolveBundledGeocodeResult("129 Bayview Ave, Port Washington, NY 11050");
    expect(barBeach).not.toBeNull();
    expect(driftwood).not.toBeNull();
    expect(bayview).not.toBeNull();
  });

  it("does not snap Highland Place in Sea Cliff to Highland Ave in Port Washington", () => {
    const highlandAve = resolveBundledGeocodeResult("10 Highland Ave, Port Washington, NY 11050");
    const highlandPl = resolveBundledGeocodeResult("12 Highland Place, Sea Cliff, NY 11579");
    expect(highlandAve).not.toBeNull();
    if (highlandPl) {
      expect(
        Math.abs(highlandPl.lat - highlandAve!.lat) + Math.abs(highlandPl.lng - highlandAve!.lng),
      ).toBeGreaterThan(0.02);
    } else {
      expect(highlandPl).toBeNull();
    }
  });
});
