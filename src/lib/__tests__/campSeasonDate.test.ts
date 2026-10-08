import { describe, expect, it } from "vitest";
import {
  campDateInSeason,
  campDateStringInSeason,
  campTodayDate,
  campTodayString,
} from "@/lib/campSeasonDate";

describe("campSeasonDate", () => {
  const now = new Date("2026-09-22T21:53:00-04:00");

  it("camp today uses real calendar year in camp timezone", () => {
    expect(campTodayString(now)).toBe("2026-09-22");
    expect(campTodayDate(now).getFullYear()).toBe(2026);
    expect(campTodayDate(now).getMonth()).toBe(8);
    expect(campTodayDate(now).getDate()).toBe(22);
  });

  it("sidebar season does not shift operational dates", () => {
    expect(campDateStringInSeason("2027", now)).toBe("2026-09-22");
    expect(campDateStringInSeason("2026", now)).toBe("2026-09-22");
    const operational = campDateInSeason("2027", now);
    expect(operational.getFullYear()).toBe(2026);
    expect(operational.getMonth()).toBe(8);
    expect(operational.getDate()).toBe(22);
  });
});
