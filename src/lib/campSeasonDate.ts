import { CAMP_TIMEZONE } from "@/lib/parentPortalCutoff";
import { parseLocalDate } from "@/lib/utils";

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

function campYmdFromParts(parts: CampTimezoneParts, year: number): string {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Real camp-timezone calendar date (America/New_York) — not shifted to sidebar season year. */
export function campTodayDate(now = new Date()): Date {
  const parts = campTimezoneParts(now);
  return parseLocalDate(campYmdFromParts(parts, parts.year));
}

/** YYYY-MM-DD for “today” queries, menu, dashboard, birthdays, transport run date, etc. */
export function campTodayString(now = new Date()): string {
  const parts = campTimezoneParts(now);
  return campYmdFromParts(parts, parts.year);
}

/**
 * Operational calendar date. Season selects roster rows (`children.season`), not the wall clock.
 * @deprecated Prefer campTodayDate — kept for call sites that still pass season for API compatibility.
 */
export function campDateInSeason(_season: string, now = new Date()): Date {
  return campTodayDate(now);
}

/** Default Master Calendar month for day camps (June 1 of the selected season). */
export function campSeasonDefaultCalendarDate(season: string): Date {
  const seasonYear = Number.parseInt(season, 10);
  if (!Number.isFinite(seasonYear)) return new Date();
  return new Date(seasonYear, 5, 1);
}

/** @deprecated Prefer campTodayString — season does not change the calendar year. */
export function campDateStringInSeason(_season: string, now = new Date()): string {
  return campTodayString(now);
}
