import { describe, expect, it } from "vitest";
import { buildGroupReportPdf, groupReportRowColumns } from "@/lib/transportCampMinderReportsPdf";
import { sanitizeBarcodePayload } from "@/lib/transportReportPdfLayout";

describe("transportReportPdfLayout", () => {
  it("sanitizeBarcodePayload strips invalid chars", () => {
    expect(sanitizeBarcodePayload("person-123abc")).toBe("PERSON123ABC");
  });

  it("keeps group-report columns from overlapping on a letter page", () => {
    const cols = groupReportRowColumns(215.9, 12, "daily", true);
    expect(cols.leftRight).toBeLessThanOrEqual(cols.contactX);
    expect(cols.contactRight).toBeLessThanOrEqual(cols.barcodeX);
    expect(cols.barcodeRight).toBeLessThanOrEqual(cols.bubbleX);
    expect(cols.bubbleRight).toBeLessThanOrEqual(215.9 - 12);
    expect(cols.leftRight - 12).toBeGreaterThanOrEqual(40);
    expect(cols.contactRight - cols.contactX).toBeGreaterThanOrEqual(34);
  });

  it("builds a group report with the weekday labels in the circle column", () => {
    const built = buildGroupReportPdf({
      companyName: "North Shore Day Camp",
      season: "2026",
      weekDateRange: "Week 1",
      groupName: "Blue Jays",
      totalCampers: 1,
      staffNames: ["Jamie Counselor"],
      campers: [
        {
          name: "Alina Haynes",
          demographicsLine: "(F|Kindergarten)",
          programLine: "",
          transportLine: "",
          contactsBlock: "Mother: Meredith\n(C: 555-0100)",
          barcodeValue: "12345",
          addressLine: "10 Oak Street, Glen Cove, NY 11542",
          divisionLine: "K",
          sessionLine: "Full 8 Weeks",
        },
      ],
    });
    expect(built).not.toBeNull();
    expect(built!.blob.size).toBeGreaterThan(800);
  });
});
