import { describe, expect, it } from "vitest";
import {
  attendanceEnrollmentWeek,
  buildMonFriEnrollmentWeeks,
  camperEnrolledInWeek,
  enrollmentWeekForDate,
  enrollmentWeekDayColumns,
  enrollmentWeekSpanDays,
  formatEnrollmentWeekRange,
  isEnrollmentWeekCalendarComplete,
  printEnrollmentWeekRow,
  resolveEnrollmentWeekRow,
} from "@/lib/enrollmentWeekCalendar";

describe("enrollmentWeekCalendar", () => {
  it("builds 8 Mon–Fri blocks from Week 1 start", () => {
    const weeks = buildMonFriEnrollmentWeeks("2027-06-28");
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toEqual({
      weekNumber: 1,
      startDate: "2027-06-28",
      endDate: "2027-07-02",
    });
    expect(weeks[1].startDate).toBe("2027-07-05");
  });

  it("resolves enrollment week for a calendar date", () => {
    const calendar = buildMonFriEnrollmentWeeks("2027-06-28");
    expect(enrollmentWeekForDate(calendar, "2027-06-30")).toBe(1);
    expect(enrollmentWeekForDate(calendar, "2027-07-06")).toBe(2);
    expect(enrollmentWeekForDate(calendar, "2027-08-01")).toBeNull();
  });

  it("prints the nearest camp week when the report date is outside the calendar", () => {
    const calendar = buildMonFriEnrollmentWeeks("2027-06-28");
    expect(enrollmentWeekForDate(calendar, "2026-10-07")).toBeNull();
    expect(attendanceEnrollmentWeek(calendar, "2026-10-07")).toBe(1);
    expect(attendanceEnrollmentWeek(calendar, "2026-10-07", 4)).toBe(4);
  });

  it("matches week dates stored with a time suffix", () => {
    const calendar = [
      {
        weekNumber: 1,
        startDate: "2027-06-28T00:00:00+00:00",
        endDate: "2027-07-02T00:00:00+00:00",
      },
    ];
    expect(enrollmentWeekForDate(calendar, "2027-06-28")).toBe(1);
    expect(enrollmentWeekForDate(calendar, "2027-07-02")).toBe(1);
  });

  it("filters campers by enrolled weeks", () => {
    expect(camperEnrolledInWeek([1, 2, 3], null, 2)).toBe(true);
    expect(camperEnrolledInWeek([1, 2, 3], null, 5)).toBe(false);
    expect(camperEnrolledInWeek(null, "Week 4", 4)).toBe(true);
  });

  it("clamps a season-long week to Mon–Fri of the report date", () => {
    const row = { weekNumber: 1, startDate: "2027-01-28", endDate: "2027-07-03" };
    expect(enrollmentWeekSpanDays(row)).toBeGreaterThan(6);
    expect(printEnrollmentWeekRow(row, "2027-07-01")).toEqual({
      weekNumber: 1,
      startDate: "2027-06-28",
      endDate: "2027-07-02",
    });
    const label = formatEnrollmentWeekRange(row, "2027-07-01");
    expect(label).toContain("Jun 28");
    expect(label).toContain("Jul 2, 2027");
    expect(enrollmentWeekDayColumns(row, "2027-07-01").map((d) => d.sublabel)).toEqual([
      "6/28",
      "6/29",
      "6/30",
      "7/1",
      "7/2",
    ]);
  });

  it("clamps a season-long week to the last Mon–Fri when no report date is given", () => {
    const row = { weekNumber: 1, startDate: "2027-01-28", endDate: "2027-07-03" };
    expect(printEnrollmentWeekRow(row)).toEqual({
      weekNumber: 1,
      startDate: "2027-06-28",
      endDate: "2027-07-02",
    });
  });

  it("formats week date ranges", () => {
    const label = formatEnrollmentWeekRange({
      weekNumber: 1,
      startDate: "2027-06-28",
      endDate: "2027-07-02",
    });
    expect(label).toContain("Jun 28");
    expect(label).toContain("Jul 2, 2027");
  });

  it("prefers saved week dates over draft", () => {
    const saved = [{ weekNumber: 2, startDate: "2027-07-05", endDate: "2027-07-09" }];
    const draft = [{ weekNumber: 2, startDate: "2027-01-09", endDate: "2027-07-09" }];
    expect(resolveEnrollmentWeekRow(saved, draft, 2).source).toBe("saved");
    expect(resolveEnrollmentWeekRow([], draft, 2).source).toBe("draft");
  });

  it("requires all 8 weeks for a complete calendar", () => {
    expect(isEnrollmentWeekCalendarComplete(buildMonFriEnrollmentWeeks("2027-06-28"))).toBe(true);
    expect(
      isEnrollmentWeekCalendarComplete([
        { weekNumber: 1, startDate: "2027-06-28", endDate: "2027-07-02" },
      ]),
    ).toBe(false);
  });
});
