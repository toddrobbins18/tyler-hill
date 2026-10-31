import { describe, expect, it } from "vitest";
import { sanitizeBarcodePayload } from "@/lib/transportReportPdfLayout";

describe("transportReportPdfLayout", () => {
  it("sanitizeBarcodePayload strips invalid chars", () => {
    expect(sanitizeBarcodePayload("person-123abc")).toBe("PERSON123ABC");
  });
});
