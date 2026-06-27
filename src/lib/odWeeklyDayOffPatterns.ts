import { addDays, format, parseISO } from "date-fns";
import { normalizeSpreadsheetDate } from "@/lib/spreadsheetDates";
import { pickCell } from "@/lib/spreadsheetRowUtils";

/** JS Date.getDay(): 0 = Sunday … 6 = Saturday */
const WEEKDAY_TOKEN_TO_DOW: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

export type OdWeeklyPatternKey = "tuesday" | "wednesday" | "thursday";

/** Tyler Hill OD recurring schedules (see camp OD spreadsheet legend). */
export const OD_WEEKLY_PATTERNS: Record<
  OdWeeklyPatternKey,
  { dayOffWeekday: number; nightOffWeekdays: number[]; label: string }
> = {
  tuesday: {
    dayOffWeekday: 2,
    nightOffWeekdays: [1, 2, 4, 5],
    label: "Tuesday day off",
  },
  wednesday: {
    dayOffWeekday: 3,
    nightOffWeekdays: [2, 3, 5, 0],
    label: "Wednesday day off",
  },
  thursday: {
    dayOffWeekday: 4,
    nightOffWeekdays: [1, 3, 4, 0],
    label: "Thursday day off",
  },
};

export function parseWeekdayToken(value: string): number | null {
  const key = value.trim().toLowerCase();
  if (key in WEEKDAY_TOKEN_TO_DOW) {
    return WEEKDAY_TOKEN_TO_DOW[key];
  }
  return null;
}

export function weeklyPatternKeyFromDayOffColumn(value: string): OdWeeklyPatternKey | null {
  const dow = parseWeekdayToken(value);
  if (dow === 2) return "tuesday";
  if (dow === 3) return "wednesday";
  if (dow === 4) return "thursday";
  return null;
}

export function getSeasonDateRange(season: string): { start: string; end: string } {
  const year = /^\d{4}$/.test(String(season).trim())
    ? String(season).trim()
    : String(new Date().getFullYear());
  return { start: `${year}-06-01`, end: `${year}-08-31` };
}

export type ExpandedStaffDayOffRow = {
  person_id: string;
  date: string;
  is_day_off: boolean;
  is_night_off: boolean;
  notes: string | null;
};

export function expandWeeklyPatternRows(
  personId: string,
  patternKey: OdWeeklyPatternKey,
  season: string,
): ExpandedStaffDayOffRow[] {
  const pattern = OD_WEEKLY_PATTERNS[patternKey];
  const { start, end } = getSeasonDateRange(season);
  const out: ExpandedStaffDayOffRow[] = [];

  let cursor = parseISO(start);
  const endDate = parseISO(end);

  while (cursor <= endDate) {
    const dow = cursor.getDay();
    const dateStr = format(cursor, "yyyy-MM-dd");

    if (dow === pattern.dayOffWeekday) {
      out.push({
        person_id: personId,
        date: dateStr,
        is_day_off: true,
        is_night_off: true,
        notes: pattern.label,
      });
    } else if (pattern.nightOffWeekdays.includes(dow)) {
      out.push({
        person_id: personId,
        date: dateStr,
        is_day_off: false,
        is_night_off: true,
        notes: "Night off",
      });
    }

    cursor = addDays(cursor, 1);
  }

  return out;
}

function pickPersonId(row: Record<string, unknown>): string {
  return pickCell(row, "person_id", "Person ID", "PersonID", "personid", "Staff Person ID").trim();
}

function looksLikePersonId(value: string): boolean {
  return /^\d{5,12}$/.test(value.replace(/\s/g, ""));
}

export function isLikelyStaffDaysOffPatternRow(row: Record<string, unknown>): boolean {
  const personId = pickPersonId(row);
  if (!looksLikePersonId(personId)) return false;

  const dateRaw = pickCell(row, "date", "Date", "DATE");
  if (normalizeSpreadsheetDate(dateRaw)) return false;

  const dayOffRaw = pickCell(row, "day_off", "Day Off", "day off", "DAY OFF", "is_day_off", "Is Day Off");
  return weeklyPatternKeyFromDayOffColumn(dayOffRaw) !== null;
}

export function preprocessStaffDaysOffUploadRows(
  rows: Record<string, unknown>[],
  season: string,
): {
  rows: Record<string, unknown>[];
  patternStaffCount: number;
  skippedLegendRows: number;
  expandedRowCount: number;
} {
  const expanded: Record<string, unknown>[] = [];
  let patternStaffCount = 0;
  let skippedLegendRows = 0;

  for (const row of rows) {
    if (isLikelyStaffDaysOffPatternRow(row)) {
      const personId = pickPersonId(row);
      const dayOffRaw = pickCell(row, "day_off", "Day Off", "day off", "DAY OFF", "is_day_off", "Is Day Off");
      const patternKey = weeklyPatternKeyFromDayOffColumn(dayOffRaw);
      if (!patternKey) continue;

      const datedRows = expandWeeklyPatternRows(personId, patternKey, season);
      expanded.push(...datedRows);
      patternStaffCount += 1;
      continue;
    }

    const personId = pickPersonId(row);
    const dateRaw = pickCell(row, "date", "Date", "DATE");
    const date = normalizeSpreadsheetDate(dateRaw);

    if (!looksLikePersonId(personId) || !date) {
      skippedLegendRows += 1;
      continue;
    }

    expanded.push(row);
  }

  return {
    rows: expanded,
    patternStaffCount,
    skippedLegendRows,
    expandedRowCount: expanded.length,
  };
}

export const STAFF_DAYS_OFF_WEEKLY_PATTERN_TEMPLATE = `PersonID,Day Off
20424253,THURSDAY
20542345,TUESDAY
20599277,WEDNESDAY`;
