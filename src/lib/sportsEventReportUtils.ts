import { isValid, parse } from "date-fns";
import { formatTime12Hour } from "@/lib/utils";

export type SportsEventTimeFields = {
  start_time_field?: string | null;
  time?: string | null;
  depart_time?: string | null;
};

export type SportsEventReportRow = Record<string, string | number | null | undefined> & {
  Date: string;
  Time: string;
  Event: string;
  "Meal Options": string;
  Driver: string;
};

const SORT_TIME_KEY = "__sortTimeMinutes";

export function getSportsEventRawTime(event: SportsEventTimeFields): string | null {
  const rawTime = event.start_time_field || event.time || event.depart_time;
  if (!rawTime || typeof rawTime !== "string") return null;

  const trimmedTime = rawTime.trim();
  return trimmedTime || null;
}

export function normalizeSportsEventTimeToMinutes(rawTime: string | null | undefined): number | null {
  if (!rawTime) return null;

  const startPortion = rawTime.split("-")[0]?.trim() || rawTime;

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(startPortion)) {
    const [hours, minutes] = startPortion.split(":").map(Number);
    return hours * 60 + minutes;
  }

  if (/^\d{1,2}:\d{2}$/.test(startPortion)) {
    const [hours, minutes] = startPortion.split(":").map(Number);
    return hours * 60 + minutes;
  }

  const parsed12Hour = parse(startPortion, "h:mm a", new Date());
  if (isValid(parsed12Hour)) {
    return parsed12Hour.getHours() * 60 + parsed12Hour.getMinutes();
  }

  const parsedHourOnly = parse(startPortion, "h a", new Date());
  if (isValid(parsedHourOnly)) {
    return parsedHourOnly.getHours() * 60 + parsedHourOnly.getMinutes();
  }

  return null;
}

export function formatSportsEventReportTime(event: SportsEventTimeFields): string {
  const rawTime = getSportsEventRawTime(event);
  if (!rawTime) return "TBD";

  const startPortion = rawTime.split("-")[0]?.trim() || rawTime;
  if (/AM|PM/i.test(startPortion)) {
    return rawTime;
  }

  const normalizedMinutes = normalizeSportsEventTimeToMinutes(startPortion);
  if (normalizedMinutes == null) {
    return rawTime;
  }

  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  const normalized24 = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return formatTime12Hour(normalized24) || rawTime;
}

export function formatSportsEventMealOptions(
  mealOptions: string[] | string | null | undefined,
): string {
  if (!mealOptions) return "-";

  if (Array.isArray(mealOptions)) {
    const formatted = mealOptions.filter(Boolean).join(", ");
    return formatted || "-";
  }

  if (typeof mealOptions === "string") {
    const trimmed = mealOptions.trim();
    if (!trimmed) return "-";

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const formatted = parsed.filter(Boolean).join(", ");
        return formatted || "-";
      }
    } catch {
      // Fall through to raw string.
    }

    return trimmed;
  }

  return "-";
}

export function attachSportsEventSortTime(row: SportsEventReportRow, event: SportsEventTimeFields): SportsEventReportRow {
  Object.defineProperty(row, SORT_TIME_KEY, {
    value: normalizeSportsEventTimeToMinutes(getSportsEventRawTime(event)),
    enumerable: false,
    configurable: true,
  });

  return row;
}

export function getSportsEventRowSortTimeMinutes(row: SportsEventReportRow): number {
  const minutes = (row as Record<string, unknown>)[SORT_TIME_KEY];
  return typeof minutes === "number" ? minutes : Number.POSITIVE_INFINITY;
}

export function compareSportsEventReportRows(
  a: SportsEventReportRow,
  b: SportsEventReportRow,
  direction: "asc" | "desc" = "asc",
): number {
  const dateA = new Date(`${a.Date}T00:00:00`).getTime();
  const dateB = new Date(`${b.Date}T00:00:00`).getTime();
  let comparison = dateA - dateB;

  if (comparison === 0) {
    comparison = getSportsEventRowSortTimeMinutes(a) - getSportsEventRowSortTimeMinutes(b);
  }

  return direction === "asc" ? comparison : -comparison;
}

export function sortSportsEventReportRows(
  rows: SportsEventReportRow[],
  direction: "asc" | "desc" = "asc",
): SportsEventReportRow[] {
  return [...rows].sort((a, b) => compareSportsEventReportRows(a, b, direction));
}

export function buildSportsEventReportRow(
  event: SportsEventTimeFields & { id?: string; event_date?: string; title?: string | null; meal_options?: string[] | null },
  driverByEventId: Map<string, string>,
): SportsEventReportRow {
  const row: SportsEventReportRow = {
    Date: event.event_date || "",
    Time: formatSportsEventReportTime(event),
    Event: event.title || "N/A",
    "Meal Options": formatSportsEventMealOptions(event.meal_options),
    Driver: (event.id && driverByEventId.get(event.id)) || "-",
  };

  return attachSportsEventSortTime(row, event);
}

export function buildDriverBySportsEventId(
  trips: Array<{ sports_event_id?: string | null; driver?: string | null }> | null | undefined,
): Map<string, string> {
  const driverByEventId = new Map<string, string>();

  (trips || []).forEach((trip) => {
    if (trip.sports_event_id && trip.driver) {
      driverByEventId.set(trip.sports_event_id, trip.driver);
    }
  });

  return driverByEventId;
}
