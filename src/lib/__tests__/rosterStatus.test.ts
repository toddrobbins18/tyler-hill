import { describe, expect, it } from "vitest";
import {
  filterEnrolledCampers,
  filterHiredStaffForBirthday,
  isActiveRosterStatus,
  isEnrolledCamperStatus,
  isHiredStaffForBirthday,
} from "@/lib/rosterStatus";

describe("rosterStatus", () => {
  it("isActiveRosterStatus treats null/empty as on-roster", () => {
    expect(isActiveRosterStatus(null)).toBe(true);
    expect(isActiveRosterStatus("")).toBe(true);
    expect(isActiveRosterStatus("inactive")).toBe(false);
  });

  it("isEnrolledCamperStatus requires explicit active", () => {
    expect(isEnrolledCamperStatus("active")).toBe(true);
    expect(isEnrolledCamperStatus("Active")).toBe(true);
    expect(isEnrolledCamperStatus(null)).toBe(false);
    expect(isEnrolledCamperStatus("")).toBe(false);
    expect(isEnrolledCamperStatus("inactive")).toBe(false);
  });

  it("isHiredStaffForBirthday requires active status and valid name", () => {
    expect(isHiredStaffForBirthday({ status: "active", name: "Jane Doe" })).toBe(true);
    expect(isHiredStaffForBirthday({ status: "active", name: "Unknown" })).toBe(false);
    expect(isHiredStaffForBirthday({ status: null, name: "Jane Doe" })).toBe(false);
    expect(isHiredStaffForBirthday({ status: "inactive", name: "Jane Doe" })).toBe(false);
  });

  it("filterEnrolledCampers and filterHiredStaffForBirthday", () => {
    expect(
      filterEnrolledCampers([
        { status: "active" },
        { status: null },
        { status: "inactive" },
      ]),
    ).toEqual([{ status: "active" }]);

    expect(
      filterHiredStaffForBirthday([
        { status: "active", name: "Sam" },
        { status: "active", name: "Unknown" },
        { status: "inactive", name: "Pat" },
      ]),
    ).toEqual([{ status: "active", name: "Sam" }]);
  });
});
