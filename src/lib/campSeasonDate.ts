import { CAMP_TIMEZONE } from "@/lib/parentPortalCutoff";

type CampTimezoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Wall-clock date/time parts in camp timezone (America/New_York). */
export function campTimezoneParts(now = new Date()): CampTimezoneParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Same month/day/time as now, but year from the selected camp season (staff UI). */
export function campDateInSeason(season: string, now = new Date()): Date {
  const seasonYear = Number.parseInt(season, 10);
  if (!Number.isFinite(seasonYear)) return now;

  const parts = campTimezoneParts(now);
  if (parts.year === seasonYear) return now;

  return new Date(
    seasonYear,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** Default Master Calendar month for day camps (June 1 of the selected season). */
export function campSeasonDefaultCalendarDate(season: string): Date {
  const seasonYear = Number.parseInt(season, 10);
  if (!Number.isFinite(seasonYear)) return new Date();
  return new Date(seasonYear, 5, 1);
}

/** YYYY-MM-DD for staff queries — aligned to selected season year. */
export function campDateStringInSeason(season: string, now = new Date()): string {
  const parts = campTimezoneParts(campDateInSeason(season, now));
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}
