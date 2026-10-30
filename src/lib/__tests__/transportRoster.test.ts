import { describe, expect, it } from "vitest";
import { normCamperNameKey } from "@/lib/routeReferenceWarehouse";
import {
  applyGeocodeResultsToTransportBoard,
  buildMappoint2026AddressHints,
  collectTransportAddressesNeedingGeocode,
  fixBoardAddressesFromEnrollment,
  pruneEmptyPassengerStops,
} from "@/lib/transportRoster";
import { CAMP_LOCATION } from "@/lib/transportStopTimes";

describe("transportRoster address hints", () => {
  it("matches roster names from MapPoint comma and ampersand lists", () => {
    const hints = buildMappoint2026AddressHints();

    expect(hints.get(normCamperNameKey("Aayhan Kazmi"))?.address).toContain("26 S George St");
    expect(hints.get(normCamperNameKey("Adam Detore"))?.address).toContain("3 Verity Ln");
    expect(hints.get(normCamperNameKey("Abigail Yuabov"))?.address).toContain("8 Willow Rd");
    expect(hints.get(normCamperNameKey("Alessandro Gallina"))?.address).toContain("248 Oyster Bay Rd");
    expect(hints.get(normCamperNameKey("Alexa Ferraro"))?.address).toContain("6 Maple Ave");
    expect(hints.get(normCamperNameKey("Anthony Ferraro"))?.address).toContain("6 Maple Ave");
    expect(hints.get(normCamperNameKey("Brayden Morrison"))?.address).toContain("11 Eden Roc Dr");
    expect(hints.get(normCamperNameKey("Adam Osman"))?.address).toContain("412 Mill River Rd");
  });

  it("builds a large hint map from routes and addresses CSV", () => {
    const hints = buildMappoint2026AddressHints();
    expect(hints.size).toBeGreaterThan(400);
  });
});

describe("transport board geocoding helpers", () => {
  it("collects unplotted and routed addresses missing coordinates", () => {
    const pending = collectTransportAddressesNeedingGeocode(
      [
        {
          id: 1,
          name: "Jamie Lee",
          address: "123 Main St, Glen Cove, NY",
          lat: 0,
          lng: 0,
          age: 10,
          session: "Session 1",
        },
      ],
      {
        7: [
          {
            name: "Open stop",
            address: "456 Oak Ave, Sea Cliff, NY",
            lat: 0,
            lng: 0,
            pickupTime: "",
            passengers: 0,
          },
        ],
      },
      CAMP_LOCATION.address,
    );

    expect(pending).toEqual([
      "123 Main St, Glen Cove, NY",
      "456 Oak Ave, Sea Cliff, NY",
    ]);
  });

  it("applies geocode results to unplotted campers and route stops", () => {
    const results = new Map([
      ["123 main st, glen cove, ny", { lat: 40.88, lng: -73.64 }],
    ]);

    const applied = applyGeocodeResultsToTransportBoard(
      [
        {
          id: 1,
          name: "Jamie Lee",
          address: "123 Main St, Glen Cove, NY",
          lat: 0,
          lng: 0,
          age: 10,
          session: "Session 1",
        },
      ],
      {},
      results,
      CAMP_LOCATION.address,
    );

    expect(applied.updatedCount).toBe(1);
    expect(applied.unplotted[0]?.lat).toBe(40.88);
    expect(applied.unplotted[0]?.lng).toBe(-73.64);
  });
});

describe("pruneEmptyPassengerStops", () => {
  it("drops MapPoint template stops with no riders but keeps staffed stops and camp", () => {
    const pruned = pruneEmptyPassengerStops({
      1: [
        {
          name: "Open",
          address: "50 Ashwood Rd, Port Washington, NY",
          lat: 40.84,
          lng: -73.71,
          pickupTime: "",
          passengers: 0,
        },
        {
          name: "Alex Rubel",
          address: "34 Dunes Ln, Port Washington, NY",
          lat: 40.84,
          lng: -73.72,
          pickupTime: "7:00 AM",
          passengers: 1,
          camperNames: ["Alex Rubel"],
        },
        {
          name: CAMP_LOCATION.name,
          address: CAMP_LOCATION.address,
          lat: CAMP_LOCATION.lat,
          lng: CAMP_LOCATION.lng,
          pickupTime: "",
          passengers: 0,
        },
      ],
    });

    expect(pruned[1]).toHaveLength(2);
    expect(pruned[1]?.[0]?.camperNames).toEqual(["Alex Rubel"]);
    expect(pruned[1]?.[1]?.address).toBe(CAMP_LOCATION.address);
  });
});

describe("fixBoardAddressesFromEnrollment", () => {
  it("splits a mega-stop using MapPoint hints when 2026 home_address is null", () => {
    const hints = buildMappoint2026AddressHints();
    expect(hints.get(normCamperNameKey("Amelia Flores"))?.address).toContain("61 Locust");
    expect(hints.get(normCamperNameKey("August Meile"))?.address).toContain("9 Central");

    const fixed = fixBoardAddressesFromEnrollment({
      enrolled: [
        {
          id: "1",
          personId: null,
          name: "Amelia Flores",
          age: 7,
          session: null,
          grade: "1st",
          groupName: "Madrid",
          homeAddress: null,
        },
        {
          id: "2",
          personId: null,
          name: "August Meile",
          age: 5,
          session: null,
          grade: "Pre - K",
          groupName: "Manatees",
          homeAddress: null,
        },
      ],
      coreStops: {
        1: [
          {
            name: "Amelia Flores +1",
            address: "96 Barkers Point Rd, Port Washington, NY 11050",
            lat: 40.84,
            lng: -73.72,
            pickupTime: "7:07 AM",
            passengers: 2,
            camperNames: ["Amelia Flores", "August Meile"],
          },
        ],
      },
      unplottedCampers: [],
      addressHints: hints,
    });

    expect(fixed.splitStopCount).toBe(1);
    const stops = fixed.coreStops[1] ?? [];
    expect(stops.length).toBeGreaterThanOrEqual(2);
  });

  it("splits shared stops when riders have different CampMinder addresses", () => {
    const fixed = fixBoardAddressesFromEnrollment({
      enrolled: [
        {
          id: "1",
          personId: null,
          name: "Amelia Flores",
          age: 10,
          session: null,
          grade: null,
          groupName: null,
          homeAddress: "61 Locust Avenue, Sea Cliff, NY 11579",
        },
        {
          id: "2",
          personId: null,
          name: "August Meile",
          age: 10,
          session: null,
          grade: null,
          groupName: null,
          homeAddress: "9 Central Drive, Glen Head, NY 11545",
        },
      ],
      coreStops: {
        1: [
          {
            name: "Amelia Flores +1",
            address: "9 Central Drive, Glen Head, NY 11545",
            lat: 40.1,
            lng: -73.6,
            pickupTime: "8:00",
            passengers: 2,
            camperNames: ["Amelia Flores", "August Meile"],
          },
        ],
      },
      unplottedCampers: [],
    });

    expect(fixed.splitStopCount).toBe(1);
    expect(fixed.fixedStopCount).toBe(1);
    const stops = fixed.coreStops[1] ?? [];
    expect(stops).toHaveLength(2);
    const amelia = stops.find((s) => s.camperNames?.includes("Amelia Flores"));
    const august = stops.find((s) => s.camperNames?.includes("August Meile"));
    expect(amelia?.address).toContain("61 Locust");
    expect(august?.address).toContain("9 Central Drive");
  });
});
