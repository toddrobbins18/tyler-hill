import { format, isValid, parseISO } from "date-fns";

const CAMP_TIMEZONE = "America/New_York";

/** Parse DB / API date strings without throwing on bad data. */
export function safeParseDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return isValid(value) ? value : null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = parseISO(trimmed);
    return isValid(parsed) ? parsed : null;
  }

  const parsed = new Date(trimmed);
  return isValid(parsed) ? parsed : null;
}

export function safeFormatDate(
  value: string | Date | null | undefined,
  dateFormat: string,
  fallback = "—",
): string {
  const parsed = safeParseDate(value);
  if (!parsed) return fallback;
  try {
    return format(parsed, dateFormat);
  } catch {
    return fallback;
  }
}

/** Format a Postgres `date` column (YYYY-MM-DD). */
export function safeFormatDateYmd(
  value: string | null | undefined,
  dateFormat: string,
  fallback = "—",
): string {
  if (!value) return fallback;
  return safeFormatDate(`${value}T12:00:00`, dateFormat, fallback);
}

/** Health Center / camp timestamps always display in US Eastern. */
export function formatCampDateTime(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  const parsed = safeParseDate(value);
  if (!parsed) return fallback;
  try {
    return parsed.toLocaleString("en-US", {
      timeZone: CAMP_TIMEZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return fallback;
  }
}

export function formatCampTime(
  value: string | Date | null | undefined,
  fallback = "—",
): string {
  const parsed = safeParseDate(value);
  if (!parsed) return fallback;
  try {
    return parsed.toLocaleString("en-US", {
      timeZone: CAMP_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return fallback;
  }
}
