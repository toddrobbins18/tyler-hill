import { describe, expect, it } from "vitest";
import { campDateInSeason, campDateStringInSeason } from "@/lib/campSeasonDate";

describe("campSeasonDate", () => {
  const now = new Date("2026-09-22T21:53:00-04:00");

  it("keeps real date when season year matches camp timezone year", () => {
    expect(campDateStringInSeason("2026", now)).toBe("2026-09-22");
  });

  it("shifts year to selected season while keeping month/day", () => {
    expect(campDateStringInSeason("2027", now)).toBe("2027-09-22");
  });

  it("returns a Date in the season year", () => {
    const shifted = campDateInSeason("2027", now);
    expect(shifted.getFullYear()).toBe(2027);
    expect(shifted.getMonth()).toBe(8);
    expect(shifted.getDate()).toBe(22);
  });
});
