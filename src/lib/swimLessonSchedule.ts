import { addDays, format, getDay, parseISO } from "date-fns";
import {
  type EnrollmentWeekCalendar,
  getEnrollmentWeekRow,
  buildMonFriEnrollmentWeeks,
} from "@/lib/enrollmentWeekCalendar";
import { DAY_CAMP_ENROLLMENT_WEEKS } from "@/lib/enrolledWeeks";
import { campDateTimeToIso } from "@/lib/campTime";

/** Monday=1 … Friday=5 (matches JS getDay for Mon–Fri). */
export type CampWeekday = 1 | 2 | 3 | 4 | 5;

export const CAMP_WEEKDAY_OPTIONS: { value: CampWeekday; short: string; label: string }[] = [
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
];

export const ALL_CAMP_WEEKDAYS: CampWeekday[] = [1, 2, 3, 4, 5];

/** 24h HH:mm — only two lesson slots per North Shore private swim. */
export const DEFAULT_SWIM_LESSON_TIME = "15:45";

export const SWIM_LESSON_TIME_OPTIONS = [
  { value: "15:45", label: "3:45 PM" },
  { value: "16:15", label: "4:15 PM" },
] as const;

export function allEnrollmentWeekNumbers(): number[] {
  return Array.from({ length: DAY_CAMP_ENROLLMENT_WEEKS }, (_, i) => i + 1);
}

export function defaultCampWeekCalendar(season: string): EnrollmentWeekCalendar {
  const year = Number.parseInt(season, 10);
  const week1Start = Number.isFinite(year) ? `${year}-06-28` : "2027-06-28";
  return buildMonFriEnrollmentWeeks(week1Start);
}

export function resolveSwimLessonWeekCalendar(
  calendar: EnrollmentWeekCalendar,
  season: string,
): EnrollmentWeekCalendar {
  if (calendar.length > 0) return calendar;
  return defaultCampWeekCalendar(season);
}

export function datesInWeekForWeekdays(
  weekStart: string,
  weekEnd: string,
  weekdays: CampWeekday[],
): string[] {
  if (weekdays.length === 0) return [];
  const weekdaySet = new Set(weekdays);
  const dates: string[] = [];
  let cursor = parseISO(weekStart);
  const end = parseISO(weekEnd);
  while (cursor <= end) {
    const dow = getDay(cursor) as CampWeekday;
    if (weekdaySet.has(dow)) {
      dates.push(format(cursor, "yyyy-MM-dd"));
    }
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function generateRecurringSwimLessonDates(
  calendar: EnrollmentWeekCalendar,
  weekNumbers: number[],
  weekdays: CampWeekday[],
): string[] {
  const unique = new Set<string>();
  for (const weekNumber of weekNumbers) {
    const row = getEnrollmentWeekRow(calendar, weekNumber);
    if (!row?.startDate || !row?.endDate) continue;
    for (const ymd of datesInWeekForWeekdays(row.startDate, row.endDate, weekdays)) {
      unique.add(ymd);
    }
  }
  return [...unique].sort();
}

export function swimLessonWeekOptions(calendar: EnrollmentWeekCalendar) {
  return Array.from({ length: DAY_CAMP_ENROLLMENT_WEEKS }, (_, i) => i + 1).map((weekNumber) => {
    const row = getEnrollmentWeekRow(calendar, weekNumber);
    const range =
      row?.startDate && row?.endDate
        ? `${row.startDate} – ${row.endDate}`
        : "Dates not set";
    return { weekNumber, label: `Week ${weekNumber}`, range };
  });
}

export function buildSwimLessonRows(params: {
  companyId: string;
  camperId: string;
  dates: string[];
  time: string;
  durationMinutes: number;
  instructor: string | null;
  location: string | null;
  costCents: number;
  notes: string | null;
  recurrenceSeriesId?: string | null;
}) {
  const seriesId = params.recurrenceSeriesId ?? null;
  return params.dates.map((ymd) => ({
    company_id: params.companyId,
    camper_id: params.camperId,
    scheduled_at: campDateTimeToIso(ymd, params.time),
    duration_minutes: params.durationMinutes,
    instructor: params.instructor,
    location: params.location,
    cost_cents: params.costCents,
    notes: params.notes,
    recurrence_series_id: seriesId,
    status: "scheduled",
  }));
}
