import { describe, expect, it } from "vitest";
import {
  formatOdCampDayYmd,
  formatOdCampDayYmdInSeason,
  OD_CAMP_DAY_ROLLOVER_HOUR,
} from "@/lib/odCampDay";

describe("odCampDay", () => {
  it("uses 1 AM rollover hour", () => {
    expect(OD_CAMP_DAY_ROLLOVER_HOUR).toBe(1);
  });

  it("keeps same camp day before 1 AM after calendar midnight", () => {
    // Tue Jul 21 2026 11:30 PM EDT = Wed Jul 22 03:30 UTC
    const signOut = new Date("2026-07-22T03:30:00.000Z");
    expect(formatOdCampDayYmd(signOut)).toBe("2026-07-21");

    // Wed Jul 22 2026 12:30 AM EDT = Wed Jul 22 04:30 UTC (still Tuesday camp day)
    const signInBefore1 = new Date("2026-07-22T04:30:00.000Z");
    expect(formatOdCampDayYmd(signInBefore1)).toBe("2026-07-21");
  });

  it("starts new camp day at 1:00 AM", () => {
    // Wed Jul 22 2026 1:00 AM EDT = Wed Jul 22 05:00 UTC
    const after1 = new Date("2026-07-22T05:00:00.000Z");
    expect(formatOdCampDayYmd(after1)).toBe("2026-07-22");
  });

  it("aligns season year for staff UI", () => {
    const instant = new Date("2026-07-22T04:30:00.000Z");
    expect(formatOdCampDayYmdInSeason("2026", instant)).toBe("2026-07-21");
    expect(formatOdCampDayYmdInSeason("2027", instant)).toBe("2027-07-21");
  });
});
