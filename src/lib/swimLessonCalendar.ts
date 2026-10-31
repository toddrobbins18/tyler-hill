import { format, parseISO } from "date-fns";
import { campDateFromTimestamp, campTimeHHmmFromIso } from "@/lib/campTime";
import {
  ALL_CAMP_WEEKDAYS,
  datesInWeekForWeekdays,
  SWIM_LESSON_TIME_OPTIONS,
} from "@/lib/swimLessonSchedule";
import { isSwimLessonBookedStatus } from "@/lib/swimLessonApproval";

export type SwimCalendarLessonFilter = {
  status: "all" | "booked" | "pending";
  /** Empty string = all instructors. */
  instructor: string;
};

export function filterSwimCalendarLessons(
  lessons: SwimCalendarLesson[],
  filter: SwimCalendarLessonFilter,
): SwimCalendarLesson[] {
  const instructorKey = filter.instructor.trim().toLowerCase();
  return lessons.filter((lesson) => {
    if (filter.status === "booked" && !isSwimLessonBookedStatus(lesson.status)) return false;
    if (filter.status === "pending" && lesson.status !== "pending") return false;
    if (instructorKey) {
      const got = lesson.instructor?.trim().toLowerCase() ?? "";
      if (got !== instructorKey) return false;
    }
    return true;
  });
}

export function swimCalendarFilterSummary(filter: SwimCalendarLessonFilter): string | undefined {
  const parts: string[] = [];
  if (filter.status === "booked") parts.push("Booked only");
  if (filter.status === "pending") parts.push("Pending only");
  if (filter.instructor.trim()) parts.push(`Instructor: ${filter.instructor.trim()}`);
  return parts.length ? parts.join(" · ") : undefined;
}
import {
  defaultEnrollmentWeekForDate,
  getEnrollmentWeekRow,
  type EnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";

export type SwimCalendarLesson = {
  id: string;
  camperName: string;
  instructor: string | null;
  status: string;
  scheduled_at: string;
};

export type SwimSlotKey = `${string}|${string}`;

export function swimSlotKey(dateYmd: string, timeHHmm: string): SwimSlotKey {
  return `${dateYmd}|${timeHHmm}`;
}

/** Pending and booked lessons occupy a slot for scheduling purposes. */
export function lessonBlocksSwimSlot(status: string): boolean {
  if (status === "cancelled" || status === "rejected") return false;
  if (status === "pending") return true;
  return isSwimLessonBookedStatus(status);
}

function normalizeSwimSlotTime(hhmm: string): string | null {
  if (SWIM_LESSON_TIME_OPTIONS.some((o) => o.value === hhmm)) return hhmm;
  return null;
}

export function groupLessonsBySwimSlot(
  lessons: SwimCalendarLesson[],
): Map<SwimSlotKey, SwimCalendarLesson[]> {
  const map = new Map<SwimSlotKey, SwimCalendarLesson[]>();
  for (const lesson of lessons) {
    if (!lessonBlocksSwimSlot(lesson.status)) continue;
    const dateYmd = campDateFromTimestamp(lesson.scheduled_at);
    const slotTime = normalizeSwimSlotTime(campTimeHHmmFromIso(lesson.scheduled_at));
    if (!slotTime) continue;
    const key = swimSlotKey(dateYmd, slotTime);
    const list = map.get(key) ?? [];
    list.push(lesson);
    map.set(key, list);
  }
  return map;
}

export function monFriDatesForEnrollmentWeek(
  calendar: EnrollmentWeekCalendar,
  weekNumber: number,
): { ymd: string; weekdayShort: string; label: string }[] {
  const row = getEnrollmentWeekRow(calendar, weekNumber);
  if (!row?.startDate || !row?.endDate) return [];
  return datesInWeekForWeekdays(row.startDate, row.endDate, ALL_CAMP_WEEKDAYS).map((ymd) => ({
    ymd,
    weekdayShort: format(parseISO(ymd), "EEE"),
    label: format(parseISO(ymd), "EEE M/d"),
  }));
}

export function defaultSwimCalendarWeekNumber(
  calendar: EnrollmentWeekCalendar,
  campTodayYmd: string,
): number {
  return defaultEnrollmentWeekForDate(calendar, campTodayYmd) ?? 1;
}

export function availableInstructorsForSlot(
  instructorOptions: string[],
  slotLessons: SwimCalendarLesson[],
): string[] {
  const busy = new Set(
    slotLessons
      .map((l) => l.instructor?.trim().toLowerCase())
      .filter((n): n is string => Boolean(n)),
  );
  return instructorOptions.filter((name) => !busy.has(name.trim().toLowerCase()));
}

export function instructorSlotStatus(
  instructor: string,
  dateYmd: string,
  timeHHmm: string,
  slotMap: Map<SwimSlotKey, SwimCalendarLesson[]>,
): { available: boolean; lesson?: SwimCalendarLesson } {
  const lessons = slotMap.get(swimSlotKey(dateYmd, timeHHmm)) ?? [];
  const normalized = instructor.trim().toLowerCase();
  const mine = lessons.find((l) => l.instructor?.trim().toLowerCase() === normalized);
  if (mine) return { available: false, lesson: mine };
  return { available: true };
}

export const SWIM_CALENDAR_TIME_COLUMNS = SWIM_LESSON_TIME_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
