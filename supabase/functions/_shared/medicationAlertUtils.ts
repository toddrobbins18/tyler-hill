/** Shared medication schedule logic for edge functions (mirrors src/lib/medicationSchedule.ts). */

export type MedicationLogRow = {
  id: string;
  child_id: string;
  date: string;
  end_date?: string | null;
  season?: string | null;
  is_recurring?: boolean | null;
  frequency?: string | null;
  days_of_week?: string[] | null;
  medication_name?: string | null;
  meal_time?: string[] | string | null;
  scheduled_time?: string | null;
  administered?: boolean | null;
  refused?: boolean | null;
  alert_sent?: boolean | null;
  company_id?: string | null;
  dosage?: string | null;
  _fromRecurringTemplate?: boolean;
  _templateId?: string;
  _displayDate?: string;
};

export function easternTodayYMD(): string {
  const eastern = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return eastern.toISOString().split("T")[0];
}

export function easternSeasonYear(): string {
  const eastern = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return eastern.getFullYear().toString();
}

const MISSED_MED_TIMEZONE = "America/New_York";

/** Parse HH:MM or HH:MM:SS (Postgres TIME) into minutes since midnight. */
export function scheduledTimeToMinutes(scheduled: string | null | undefined): number | null {
  if (!scheduled || typeof scheduled !== "string") return null;
  const trimmed = scheduled.trim();
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function minutesSinceMidnightInTimezone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

/** True when current Eastern time is at or after the medication's scheduled slot. */
export function medicationAlertIsDue(
  now: Date,
  scheduledTime: string | null | undefined,
  timeZone = MISSED_MED_TIMEZONE,
): boolean {
  const slotMin = scheduledTimeToMinutes(scheduledTime);
  if (slotMin === null) return true;
  const nowMin = minutesSinceMidnightInTimezone(now, timeZone);
  return nowMin >= slotMin;
}

export function formatScheduledTimeForAlert(scheduled: string | null | undefined): string {
  const slotMin = scheduledTimeToMinutes(scheduled);
  if (slotMin === null) return scheduled?.trim() || "TBD";
  const h24 = Math.floor(slotMin / 60);
  const m = slotMin % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm} ET`;
}

function parseSeasonYear(season: string): number {
  const match = String(season).match(/(\d{4})/);
  if (match) return Number(match[1]);
  return new Date().getFullYear();
}

export function campProgramEndDate(season: string): string {
  const year = parseSeasonYear(season);
  return `${year}-08-12`;
}

function normalizeMealTimeEntries(mealTime: unknown): string[] {
  if (mealTime == null) return [];
  if (Array.isArray(mealTime)) {
    return mealTime.map((entry) => String(entry).trim()).filter(Boolean).sort();
  }
  if (typeof mealTime === "string") {
    const trimmed = mealTime.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => String(entry).trim()).filter(Boolean).sort();
        }
      } catch {
        /* use raw string */
      }
    }
    return [trimmed];
  }
  const single = String(mealTime).trim();
  return single ? [single] : [];
}

function mealTimeKey(mealTime: unknown): string {
  return normalizeMealTimeEntries(mealTime).join("|");
}

export function medicationSlotKey(
  med: Pick<MedicationLogRow, "child_id" | "medication_name" | "meal_time">,
): string {
  return `${med.child_id}|${med.medication_name ?? ""}|${mealTimeKey(med.meal_time)}`;
}

function weekdayName(dateYmd: string): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" });
}

export function isAsNeededMedication(med: MedicationLogRow): boolean {
  const freq = String(med.frequency ?? "").trim().toUpperCase();
  if (freq.includes("AS NEEDED") || freq === "PRN") return true;
  if (med.scheduled_time) return false;
  const meals = normalizeMealTimeEntries(med.meal_time);
  if (meals.length === 0) return true;
  return meals.every((m) => {
    const upper = m.toUpperCase();
    return upper.includes("AS NEEDED") || upper === "PRN";
  });
}

export function medicationAppliesOnDate(
  med: MedicationLogRow,
  dateYmd: string,
  season: string,
): boolean {
  const start = med.date;
  if (!start || dateYmd < start) return false;

  const end = med.end_date || campProgramEndDate(season);
  if (dateYmd > end) return false;

  if (!med.is_recurring) return med.date === dateYmd;

  const freq = med.frequency || "daily";
  if (freq === "daily" || freq === "weekly") return true;
  if (freq === "custom") {
    const days = med.days_of_week || [];
    if (days.length === 0) return true;
    return days.includes(weekdayName(dateYmd));
  }
  return true;
}

function preferMedicationRow(a: MedicationLogRow, b: MedicationLogRow): boolean {
  if (Boolean(a.administered) !== Boolean(b.administered)) {
    return Boolean(a.administered);
  }
  if (Boolean(a.refused) !== Boolean(b.refused)) {
    return Boolean(a.refused);
  }
  if (Boolean(a.is_recurring) !== Boolean(b.is_recurring)) {
    return !a.is_recurring;
  }
  if (Boolean(a._fromRecurringTemplate) !== Boolean(b._fromRecurringTemplate)) {
    return !a._fromRecurringTemplate;
  }
  return false;
}

function dedupeMedicationSlots(rows: MedicationLogRow[]): MedicationLogRow[] {
  const byKey = new Map<string, MedicationLogRow>();
  for (const row of rows) {
    const key = medicationSlotKey(row);
    const existing = byKey.get(key);
    if (!existing || preferMedicationRow(row, existing)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export function mergeMedicationsForDate(
  dateRows: MedicationLogRow[],
  recurringRows: MedicationLogRow[],
  dateYmd: string,
  season: string,
): MedicationLogRow[] {
  const dedupedDateRows = dedupeMedicationSlots(dateRows);
  const result: MedicationLogRow[] = [...dedupedDateRows];
  const existingKeys = new Set(dedupedDateRows.map((row) => medicationSlotKey(row)));

  for (const template of recurringRows) {
    if (!template.is_recurring) continue;
    if (isAsNeededMedication(template)) continue;
    if (template.date === dateYmd) continue;
    if (!medicationAppliesOnDate(template, dateYmd, season)) continue;

    const key = medicationSlotKey(template);
    if (existingKeys.has(key)) continue;

    const dayLog = dedupedDateRows.find((row) => medicationSlotKey(row) === key);
    if (dayLog?.administered === true || dayLog?.refused === true) continue;

    result.push({
      ...template,
      administered: false,
      refused: false,
      alert_sent: dayLog?.alert_sent ?? false,
      _fromRecurringTemplate: true,
      _templateId: template.id,
      _displayDate: dateYmd,
    });
    existingKeys.add(key);
  }

  return dedupeMedicationSlots(result);
}

export function findDaySpecificMedicationLog(
  dayRows: MedicationLogRow[],
  med: Pick<MedicationLogRow, "child_id" | "medication_name" | "meal_time">,
): MedicationLogRow | undefined {
  const slotKey = medicationSlotKey(med);
  return dayRows.find((row) => medicationSlotKey(row) === slotKey);
}

export function medicationAlreadyAlerted(
  med: MedicationLogRow,
  dateRows: MedicationLogRow[],
): boolean {
  if (med._fromRecurringTemplate) {
    const dayLog = findDaySpecificMedicationLog(dateRows, med);
    return dayLog?.alert_sent === true;
  }
  return med.alert_sent === true;
}
