import { describe, expect, it } from "vitest";
import {
  isMalformedTransportGeocodeAddress,
  isSuspiciousStreetSuffixAddress,
  pickPreferredStreetGeocode,
  sanitizeTransportGeocodeAddress,
  streetSuffixGeocodeCandidates,
} from "@/lib/transportAddressNormalize";
import { canonicalizeGeocodeKey, resolveBundledGeocodeResult } from "@/lib/mappointTransportImport";
import {
  applyGeocodeResultsToTransportBoard,
  buildUnplottedFromEnrollment,
  collectTransportAddressesNeedingGeocode,
} from "@/lib/transportRoster";
import { CAMP_LOCATION } from "@/lib/transportStopTimes";

const BARRESI_DIRTY =
  "152 Plymouth Ct, 11030-1556, Manhasset, NY 11030-1556";
const BARRESI_CLEAN = "152 Plymouth Ct, Manhasset, NY 11030";
const BARRESI_ROAD = "152 Plymouth Rd, Manhasset, NY 11030";
const EAST_MEADOW = { lat: 40.713, lng: -73.557 };
const GREENTREE = { lat: 40.801, lng: -73.685 };
const PLYMOUTH_RD = { lat: 40.80878, lng: -73.69177 };

describe("sanitizeTransportGeocodeAddress", () => {
  it("pulls ZIP+4 out of the city slot", () => {
    expect(sanitizeTransportGeocodeAddress(BARRESI_DIRTY)).toBe(BARRESI_CLEAN);
    expect(isMalformedTransportGeocodeAddress(BARRESI_DIRTY)).toBe(true);
    expect(isMalformedTransportGeocodeAddress(BARRESI_CLEAN)).toBe(false);
  });

  it("leaves a normal Long Island address alone", () => {
    const clean = "121 Soundview Drive, Port Washington, NY 11050";
    expect(sanitizeTransportGeocodeAddress(clean)).toBe(clean);
    expect(isMalformedTransportGeocodeAddress(clean)).toBe(false);
  });

  it("keeps ZIP+4 only at the end as a 5-digit ZIP", () => {
    expect(sanitizeTransportGeocodeAddress("152 Plymouth Ct, Manhasset, NY 11030-1556")).toBe(
      BARRESI_CLEAN,
    );
    expect(isMalformedTransportGeocodeAddress("152 Plymouth Ct, Manhasset, NY 11030-1556")).toBe(
      false,
    );
  });

  it("canonicalizes the repaired Barresi address as Manhasset, not the ZIP", () => {
    expect(canonicalizeGeocodeKey(BARRESI_DIRTY)).toBe("152 plymouth ct, manhasset, ny 11030");
  });
});

describe("street suffix fallback", () => {
  it("tries Plymouth Rd when CampMinder stored Plymouth Ct", () => {
    const candidates = streetSuffixGeocodeCandidates(BARRESI_CLEAN);
    expect(candidates[0]).toBe(BARRESI_CLEAN);
    expect(candidates).toContain(BARRESI_ROAD);
    expect(isSuspiciousStreetSuffixAddress(BARRESI_CLEAN)).toBe(true);
    expect(isSuspiciousStreetSuffixAddress(BARRESI_ROAD)).toBe(false);
  });

  it("picks the Rd geocode over a coarse park pin", () => {
    const picked = pickPreferredStreetGeocode(BARRESI_CLEAN, [
      { address: BARRESI_CLEAN, ...GREENTREE, label: "Manhasset, NY, USA" },
      { address: BARRESI_ROAD, ...PLYMOUTH_RD, label: "152 Plymouth Rd, Manhasset, NY 11030" },
    ]);
    expect(picked?.address).toBe(BARRESI_ROAD);
    expect(picked?.lat).toBeCloseTo(PLYMOUTH_RD.lat, 4);
    expect(picked?.lng).toBeCloseTo(PLYMOUTH_RD.lng, 4);
  });

  it("does not snap Manhasset Plymouth Ct onto Port Washington Plymouth Rd", () => {
    expect(resolveBundledGeocodeResult(BARRESI_CLEAN)).toBeNull();
    expect(resolveBundledGeocodeResult(BARRESI_ROAD)).toBeNull();
  });
});

describe("malformed home-address pins", () => {
  it("rebuilds the unassigned household with a clean address and no East Meadow coords", () => {
    const rebuilt = buildUnplottedFromEnrollment({
      enrolled: [
        {
          id: "1",
          personId: "1",
          name: "Miles Barresi",
          age: 4,
          session: "Full 8 Weeks",
          grade: "PK",
          groupName: null,
          homeAddress: BARRESI_DIRTY,
        },
      ],
      coreStops: {},
      existingUnplotted: [
        {
          id: 9,
          name: "Miles Barresi",
          address: BARRESI_DIRTY,
          lat: EAST_MEADOW.lat,
          lng: EAST_MEADOW.lng,
          age: 4,
          session: "Full 8 Weeks",
        },
      ],
      useBundledMappoint: true,
    });

    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0]?.address).toBe(BARRESI_CLEAN);
    expect(rebuilt[0]?.lat).toBe(0);
    expect(rebuilt[0]?.lng).toBe(0);
  });

  it("queues a malformed pin for re-geocode even when it already has coordinates", () => {
    const pending = collectTransportAddressesNeedingGeocode(
      [
        {
          id: 1,
          name: "Miles Barresi",
          address: BARRESI_DIRTY,
          lat: EAST_MEADOW.lat,
          lng: EAST_MEADOW.lng,
          age: 4,
          session: "Full 8 Weeks",
        },
      ],
      {},
      CAMP_LOCATION.address,
    );

    expect(pending).toEqual([BARRESI_CLEAN]);
  });

  it("overwrites a saved East Meadow pin once the repaired address geocodes", () => {
    const applied = applyGeocodeResultsToTransportBoard(
      [
        {
          id: 1,
          name: "Miles Barresi",
          address: BARRESI_DIRTY,
          lat: EAST_MEADOW.lat,
          lng: EAST_MEADOW.lng,
          age: 4,
          session: "Full 8 Weeks",
        },
      ],
      {},
      new Map([[BARRESI_CLEAN.toLowerCase(), { lat: 40.796, lng: -73.699 }]]),
      CAMP_LOCATION.address,
    );

    expect(applied.updatedCount).toBe(1);
    expect(applied.unplotted[0]?.address).toBe(BARRESI_CLEAN);
    expect(applied.unplotted[0]?.lat).toBe(40.796);
    expect(applied.unplotted[0]?.lng).toBe(-73.699);
  });

  it("re-geocodes a Court pin that already has coordinates and writes the Rd address", () => {
    const pending = collectTransportAddressesNeedingGeocode(
      [
        {
          id: 1,
          name: "Miles Barresi",
          address: BARRESI_CLEAN,
          lat: GREENTREE.lat,
          lng: GREENTREE.lng,
          age: 4,
          session: "Full 8 Weeks",
        },
      ],
      {},
      CAMP_LOCATION.address,
    );
    expect(pending).toEqual([BARRESI_CLEAN]);

    const applied = applyGeocodeResultsToTransportBoard(
      [
        {
          id: 1,
          name: "Miles Barresi",
          address: BARRESI_CLEAN,
          lat: GREENTREE.lat,
          lng: GREENTREE.lng,
          age: 4,
          session: "Full 8 Weeks",
        },
      ],
      {},
      new Map([[BARRESI_CLEAN.toLowerCase(), { ...PLYMOUTH_RD, address: BARRESI_ROAD }]]),
      CAMP_LOCATION.address,
    );

    expect(applied.updatedCount).toBe(1);
    expect(applied.unplotted[0]?.address).toBe(BARRESI_ROAD);
    expect(applied.unplotted[0]?.lat).toBeCloseTo(PLYMOUTH_RD.lat, 4);
    expect(applied.unplotted[0]?.lng).toBeCloseTo(PLYMOUTH_RD.lng, 4);
  });
});
