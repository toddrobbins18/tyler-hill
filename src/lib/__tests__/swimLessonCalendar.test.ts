import { describe, expect, it } from "vitest";
import { filterSwimCalendarLessons } from "@/lib/swimLessonCalendar";

describe("swimLessonCalendar", () => {
  const lessons = [
    {
      id: "1",
      camperName: "Ava",
      instructor: "Coach Kim",
      status: "booked",
      scheduled_at: "2027-07-07T15:45:00-04:00",
    },
    {
      id: "2",
      camperName: "Ben",
      instructor: "Coach Lee",
      status: "pending",
      scheduled_at: "2027-07-07T16:15:00-04:00",
    },
    {
      id: "3",
      camperName: "Cal",
      instructor: "Coach Kim",
      status: "pending",
      scheduled_at: "2027-07-08T15:45:00-04:00",
    },
  ];

  it("filterSwimCalendarLessons by booked status", () => {
    const out = filterSwimCalendarLessons(lessons, { status: "booked", instructor: "" });
    expect(out.map((l) => l.camperName)).toEqual(["Ava"]);
  });

  it("filterSwimCalendarLessons by instructor", () => {
    const out = filterSwimCalendarLessons(lessons, { status: "all", instructor: "Coach Kim" });
    expect(out.map((l) => l.camperName)).toEqual(["Ava", "Cal"]);
  });
});
