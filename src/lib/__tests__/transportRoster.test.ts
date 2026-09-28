import { describe, expect, it } from "vitest";
import { normCamperNameKey } from "@/lib/routeReferenceWarehouse";
import { buildMappoint2026AddressHints } from "@/lib/transportRoster";

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
