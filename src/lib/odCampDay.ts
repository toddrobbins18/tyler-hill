import { addDays, format, parseISO } from "date-fns";
import { campTimezoneParts } from "@/lib/campSeasonDate";

/** OD sign-in/out sheet rolls the camp day at 1:00 AM Eastern (not midnight). */
export const OD_CAMP_DAY_ROLLOVER_HOUR = 1;

export function odCampDayParts(now = new Date()) {
  const parts = campTimezoneParts(now);
  if (parts.hour >= OD_CAMP_DAY_ROLLOVER_HOUR) {
    return parts;
  }

  const ymd = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const prevYmd = format(addDays(parseISO(ymd), -1), "yyyy-MM-dd");
  const [year, month, day] = prevYmd.split("-").map(Number);

  return { ...parts, year, month, day };
}

/** YYYY-MM-DD for the OD sheet "today" (1 AM rollover). */
export function formatOdCampDayYmd(now = new Date()): string {
  const parts = odCampDayParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Date at local midnight for the OD camp day. */
export function odCampDayDate(now = new Date()): Date {
  const parts = odCampDayParts(now);
  return new Date(parts.year, parts.month - 1, parts.day);
}

/** Align OD camp day to the selected season year (staff UI). */
export function odCampDayDateInSeason(season: string, now = new Date()): Date {
  const seasonYear = Number.parseInt(season, 10);
  const parts = odCampDayParts(now);
  const year = Number.isFinite(seasonYear) ? seasonYear : parts.year;
  return new Date(year, parts.month - 1, parts.day);
}

export function formatOdCampDayYmdInSeason(season: string, now = new Date()): string {
  return format(odCampDayDateInSeason(season, now), "yyyy-MM-dd");
}

export function formatDateAsOdCampDayYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isViewingCurrentOdCampDay(
  selectedDate: Date,
  season: string,
  now = new Date(),
): boolean {
  return formatDateAsOdCampDayYmd(selectedDate) === formatOdCampDayYmdInSeason(season, now);
}
