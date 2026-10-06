import { describe, expect, it } from "vitest";
import { normCamperNameKey } from "@/lib/routeReferenceWarehouse";
import {
  applyGeocodeResultsToTransportBoard,
  buildMappoint2026AddressHints,
  collectTransportAddressesNeedingGeocode,
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
