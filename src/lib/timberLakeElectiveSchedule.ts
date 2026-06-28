import { addDays, format, parseISO, startOfWeek } from "date-fns";

/** Timber Lake Camp elective sign-up days (no Wednesday — camp schedule). */
export const TIMBER_LAKE_ELECTIVE_DAYS = [
  "Monday",
  "Tuesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const TIMBER_LAKE_ELECTIVE_PERIODS = [
  { id: "period-1", label: "Period 1", time: "10:00 – 11:00 AM" },
  { id: "period-2", label: "Period 2", time: "11:15 AM – 12:15 PM" },
  { id: "period-3", label: "Period 3", time: "1:45 – 2:45 PM" },
  { id: "period-4", label: "Period 4", time: "3:15 – 4:15 PM" },
  { id: "period-5", label: "Period 5", time: "4:30 – 5:30 PM" },
] as const;

export type TimberLakeElectivePeriodId = (typeof TIMBER_LAKE_ELECTIVE_PERIODS)[number]["id"];

export function parseElectivePeriodNumber(periodId: string): number | null {
  const match = /^period-(\d+)$/.exec(periodId);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** Water Ski is only offered in periods 3, 4, and 5. */
export function isWaterSkiElectivePeriod(periodId: string): boolean {
  const n = parseElectivePeriodNumber(periodId);
  return n != null && n >= 3 && n <= 5;
}

export function filterElectivesForPeriod<T extends { name: string }>(
  electives: T[],
  periodId: string,
): T[] {
  if (isWaterSkiElectivePeriod(periodId)) {
    return electives;
  }
  return electives.filter((e) => !e.name.toLowerCase().includes("water ski"));
}

export function isTimberLakeElectiveDay(dayOfWeek: string): boolean {
  return (TIMBER_LAKE_ELECTIVE_DAYS as readonly string[]).includes(dayOfWeek);
}

export function electiveSlotFromCalendarDate(date: Date): {
  calendarDate: string;
  weekStartDate: string;
  dayOfWeek: string;
} {
  const weekStartDate = format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const dayOfWeek = format(date, "EEEE");
  const calendarDate = format(date, "yyyy-MM-dd");
  return { calendarDate, weekStartDate, dayOfWeek };
}

/** Today if it is an elective day, otherwise the next elective day within a week. */
export function getDefaultElectiveCalendarDate(reference = new Date()): string {
  let d = reference;
  for (let i = 0; i < 8; i++) {
    if (isTimberLakeElectiveDay(format(d, "EEEE"))) {
      return format(d, "yyyy-MM-dd");
    }
    d = addDays(d, 1);
  }
  return format(reference, "yyyy-MM-dd");
}

export function shiftElectiveCalendarDate(ymd: string, direction: -1 | 1): string {
  let d = parseISO(ymd);
  do {
    d = addDays(d, direction);
  } while (!isTimberLakeElectiveDay(format(d, "EEEE")));
  return format(d, "yyyy-MM-dd");
}

/** If the picked date is not an elective day (e.g. Wednesday), move forward to the next valid day. */
export function normalizeElectiveCalendarDate(ymd: string): string {
  const d = parseISO(ymd);
  if (isTimberLakeElectiveDay(format(d, "EEEE"))) {
    return ymd;
  }
  let cur = d;
  for (let i = 0; i < 7; i++) {
    cur = addDays(cur, 1);
    if (isTimberLakeElectiveDay(format(cur, "EEEE"))) {
      return format(cur, "yyyy-MM-dd");
    }
  }
  return ymd;
}
