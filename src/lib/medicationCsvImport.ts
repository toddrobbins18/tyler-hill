import { STANDARD_MEAL_SCHEDULE_HHMM } from "@/lib/medicationBedtimeOptions";
import { applyDailyMedicationDefaults } from "@/lib/medicationSchedule";
import { defaultMedicationStartDate } from "@/lib/medicationStartDate";
import { normalizeSpreadsheetDate } from "@/lib/spreadsheetDates";

/** Map CSV Meal Time uppercase labels → DB constraint values (`valid_meal_times`). */
const CSV_MEAL_SLOT_TO_LABEL: Record<string, string> = {
  "BEFORE BREAKFAST": "Before Breakfast",
  "AFTER BREAKFAST": "After Breakfast",
  "BEFORE LUNCH": "Before Lunch",
  "AFTER LUNCH": "After Lunch",
  "BEFORE DINNER": "Before Dinner",
  "AFTER DINNER": "After Dinner",
  BEDTIME: "Bedtime",
  BED: "Bedtime",
};

const WEEKDAY_ALIASES: Record<string, string> = {
  SUNDAY: "Sunday",
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
};

function normalizeDateStringOrNull(value: unknown): string | null {
  return normalizeSpreadsheetDate(value);
}

function normalizeMedicationFrequencyValue(raw: unknown): string | null {
  const v = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (!v) return null;
  if (["DAILY", "EVERY DAY", "EVERYDAY", "QD"].includes(v)) return "daily";
  if (["WEEKLY", "EVERY WEEK"].includes(v)) return "weekly";
  if (["CUSTOM", "MONTHLY", "EVERY MONTH"].includes(v)) return "custom";
  if (["AS NEEDED", "PRN"].includes(v)) return null;
  if (WEEKDAY_ALIASES[v]) return "weekly";
  return null;
}

function normalizeMedicationDaysOfWeek(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw
    .map((d) => WEEKDAY_ALIASES[String(d ?? "").trim().toUpperCase()] ?? null)
    .filter((d): d is string => Boolean(d));
  return Array.from(new Set(out));
}

/** Normalize a parsed medication CSV row before insert (dates, meal times, recurrence). */
export function sanitizeMedicationLogRowForInsert(
  row: Record<string, unknown>,
  season: string,
): void {
  const normalizedDate = normalizeDateStringOrNull(row.date);
  row.date = normalizedDate || defaultMedicationStartDate(season);

  row.end_date = normalizeDateStringOrNull(row.end_date);

  if (row.dosage === "" || row.dosage === undefined) {
    row.dosage = null;
  }

  const normalizedFrequency = normalizeMedicationFrequencyValue(row.frequency);
  row.frequency = normalizedFrequency;
  row.days_of_week = normalizeMedicationDaysOfWeek(row.days_of_week);
  if (!row.is_recurring && !normalizedFrequency) {
    row.days_of_week = [];
  }

  const rawSlot = String(row.scheduled_time ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const upper = rawSlot.toUpperCase();
  const isAsNeeded =
    !upper ||
    upper.includes("AS NEEDED") ||
    upper === "PRN";

  if (isAsNeeded) {
    row.scheduled_time = null;
    row.meal_time = null;
    return;
  }

  const label = CSV_MEAL_SLOT_TO_LABEL[upper];
  if (!label) {
    row.scheduled_time = null;
    row.meal_time = null;
    return;
  }

  row.meal_time = [label];
  if (label === "Bedtime") {
    row.scheduled_time = "21:00";
  } else {
    row.scheduled_time =
      STANDARD_MEAL_SCHEDULE_HHMM[label as keyof typeof STANDARD_MEAL_SCHEDULE_HHMM] ?? "12:00";
  }

  applyDailyMedicationDefaults(row, season);
}
