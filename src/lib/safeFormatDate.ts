import { format, isValid, parseISO } from "date-fns";

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
