import { describe, expect, it } from "vitest";
import {
  amPmPartsToHHmm,
  looksLikeClockTime,
  parseAmPmParts,
  splitTutoringSchedulePeriods,
  tutoringSchedulePeriodsForSave,
} from "@/lib/amPmTime";
import { formatTime12Hour } from "@/lib/utils";

describe("amPmTime", () => {
  it("parses 24-hour and 12-hour strings", () => {
    expect(parseAmPmParts("14:30")).toEqual({ hour: 2, minute: 30, period: "PM" });
    expect(parseAmPmParts("14:30:00")).toEqual({ hour: 2, minute: 30, period: "PM" });
    expect(parseAmPmParts("9:05 AM")).toEqual({ hour: 9, minute: 5, period: "AM" });
    expect(parseAmPmParts("12:00")).toEqual({ hour: 12, minute: 0, period: "PM" });
    expect(parseAmPmParts("00:15")).toEqual({ hour: 12, minute: 15, period: "AM" });
  });

  it("round-trips to HH:mm", () => {
    expect(amPmPartsToHHmm(2, 30, "PM")).toBe("14:30");
    expect(amPmPartsToHHmm(12, 0, "AM")).toBe("00:00");
    expect(amPmPartsToHHmm(12, 0, "PM")).toBe("12:00");
  });

  it("splits clock times out of tutoring periods", () => {
    expect(splitTutoringSchedulePeriods(["1st", "14:00", "Rest Hour"])).toEqual({
      time: "14:00",
      periods: ["1st", "Rest Hour"],
    });
    expect(splitTutoringSchedulePeriods(["3:00 PM"])).toEqual({
      time: "15:00",
      periods: [],
    });
  });

  it("saves clock time as the only period for day camp", () => {
    expect(tutoringSchedulePeriodsForSave({ useClockTime: true, clockTime: "15:00", periods: ["1st"] })).toEqual([
      "15:00",
    ]);
    expect(tutoringSchedulePeriodsForSave({ useClockTime: false, clockTime: "15:00", periods: ["1st"] })).toEqual([
      "1st",
    ]);
  });

  it("formats military times for parents", () => {
    expect(formatTime12Hour("14:30")).toBe("2:30 PM");
    expect(formatTime12Hour("14:30:00")).toBe("2:30 PM");
    expect(looksLikeClockTime("1st")).toBe(false);
  });
});
