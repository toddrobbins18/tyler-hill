import { describe, expect, it } from "vitest";
import { hasCamperContactInfo, mergeCamperContact } from "@/lib/camperContactInfo";

describe("camperContactInfo", () => {
  it("uses child guardian fields when present", () => {
    const contact = mergeCamperContact(
      {
        guardian_name: "Jane Doe",
        guardian_email: "jane@example.com",
        guardian_phone: "555-0100",
      },
      null,
    );
    expect(contact.guardianName).toBe("Jane Doe");
    expect(contact.guardianEmail).toBe("jane@example.com");
    expect(hasCamperContactInfo(contact)).toBe(true);
  });

  it("falls back to linked family account when child fields are empty", () => {
    const contact = mergeCamperContact(
      {},
      {
        id: "fam-1",
        family_name: "Abady Family",
        primary_contact_name: "Parent Abady",
        email: "parent@example.com",
        phone: "555-0200",
      },
    );
    expect(contact.familyName).toBe("Abady Family");
    expect(contact.guardianName).toBe("Parent Abady");
    expect(contact.guardianEmail).toBe("parent@example.com");
    expect(contact.guardianPhone).toBe("555-0200");
  });
});
