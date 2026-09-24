import { describe, expect, it } from "vitest";
import { parseStaffQrPayload, staffQrPayload, STAFF_QR_PREFIX } from "@/lib/staffQrCode";

describe("staffQrCode", () => {
  it("builds and parses staff QR payload", () => {
    const token = "abc123";
    expect(staffQrPayload(token)).toBe(`${STAFF_QR_PREFIX}${token}`);
    expect(parseStaffQrPayload(`${STAFF_QR_PREFIX}${token}`)).toBe(token);
  });

  it("rejects non-staff payloads", () => {
    expect(parseStaffQrPayload("random-rfid")).toBeNull();
  });
});
