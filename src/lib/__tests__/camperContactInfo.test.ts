import { describe, expect, it } from "vitest";
import {
  hasCamperContactInfo,
  mergeCamperContact,
  mergeGuardianFields,
} from "@/lib/camperContactInfo";

describe("mergeGuardianFields", () => {
  it("keeps current-season values when present", () => {
    const merged = mergeGuardianFields(
      {
        guardian_name: "Current Parent",
        guardian_email: "current@example.com",
      },
      {
        guardian_name: "Old Parent",
        guardian_email: "old@example.com",
        guardian_phone: "555-0100",
      },
    );

    expect(merged.guardian_name).toBe("Current Parent");
    expect(merged.guardian_email).toBe("current@example.com");
    expect(merged.guardian_phone).toBe("555-0100");
  });

  it("fills missing fields from prior seasons", () => {
    const merged = mergeGuardianFields(
      { guardian_name: null, guardian_email: null },
      { guardian_name: "Leigh Trani", guardian_email: "ltrani@gmail.com", guardian_phone: "516-650-6818" },
    );

    expect(merged.guardian_name).toBe("Leigh Trani");
    expect(merged.guardian_email).toBe("ltrani@gmail.com");
    expect(merged.guardian_phone).toBe("516-650-6818");
  });
});

describe("mergeCamperContact", () => {
  it("prefers camper guardian fields over family defaults", () => {
    const info = mergeCamperContact(
      {
        guardian_name: "Parent One",
        guardian_email: "parent@example.com",
        guardian_phone: "555-1212",
      },
      {
        family_name: "Example Family",
        primary_contact_name: "Portal Parent",
        email: "portal@example.com",
        phone: "555-9999",
      },
      [],
    );

    expect(info.guardianName).toBe("Parent One");
    expect(info.guardianEmail).toBe("parent@example.com");
    expect(info.guardianPhone).toBe("555-1212");
    expect(info.familyName).toBe("Example Family");
    expect(hasCamperContactInfo(info)).toBe(true);
  });

  it("falls back to family contact when camper fields are blank", () => {
    const info = mergeCamperContact(
      {},
      {
        family_name: "Example Family",
        primary_contact_name: "Portal Parent",
        email: "portal@example.com",
        phone: "555-9999",
      },
      [{ full_name: "Grandma", relationship: "Grandmother", phone: "555-0000" }],
    );

    expect(info.guardianName).toBe("Portal Parent");
    expect(info.guardianEmail).toBe("portal@example.com");
    expect(info.authorizedPickups).toHaveLength(1);
    expect(hasCamperContactInfo(info)).toBe(true);
  });
});
