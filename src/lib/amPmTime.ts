/** Clock values stored as HH:mm (optionally with seconds) or already labeled AM/PM. */
const CLOCK_RE = /^\s*(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(AM|PM)?\s*$/i;

export type AmPmParts = {
  hour: number;
  minute: number;
  period: "AM" | "PM";
};

export function looksLikeClockTime(value: string | null | undefined): boolean {
  if (!value) return false;
  return CLOCK_RE.test(value.trim());
}

export function parseAmPmParts(value: string | null | undefined): AmPmParts | null {
  if (!value) return null;
  const match = value.trim().match(CLOCK_RE);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  const labeled = match[3]?.toUpperCase() as "AM" | "PM" | undefined;
  if (labeled) {
    if (hour === 0) hour = 12;
    if (hour > 12) return null;
    return { hour, minute, period: labeled };
  }
  const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return { hour: hour12, minute, period };
}

export function amPmPartsToHHmm(hour: number, minute: number, period: "AM" | "PM"): string {
  let hour24 = hour % 12;
  if (period === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function splitTutoringSchedulePeriods(periods: string[] | null | undefined): {
  time: string;
  periods: string[];
} {
  const list = periods ?? [];
  const timePeriod = list.find((p) => looksLikeClockTime(p));
  const parts = parseAmPmParts(timePeriod);
  return {
    time: parts ? amPmPartsToHHmm(parts.hour, parts.minute, parts.period) : "",
    periods: list.filter((p) => !looksLikeClockTime(p)),
  };
}

export function tutoringSchedulePeriodsForSave(opts: {
  clockTime?: string;
  periods?: string[];
  useClockTime: boolean;
}): string[] {
  if (opts.useClockTime) {
    return opts.clockTime ? [opts.clockTime] : [];
  }
  return opts.periods ?? [];
}

export const TUTORING_WEEKDAYS_DAY_CAMP = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export const TUTORING_WEEKDAYS_ALL = [
  ...TUTORING_WEEKDAYS_DAY_CAMP,
  "Saturday",
  "Sunday",
] as const;
