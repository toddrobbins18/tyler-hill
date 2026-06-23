import { addDays, format, parseISO } from "date-fns";

export type StaffDayOffScheduleRow = {
  id: string;
  date: string;
  is_day_off?: boolean | null;
  is_night_off?: boolean | null;
  is_sleeping_out?: boolean | null;
  checked_out?: boolean | null;
  checked_in?: boolean | null;
};

export type NightOffScheduleEntry = {
  date: string;
  is_night_off: boolean;
  is_day_off: boolean;
  recordId?: string;
};

/** Dates (YYYY-MM-DD) to show in Manage Nights (anchor day ± offset). */
export function buildNightOffScheduleDateRange(
  anchor: Date,
  daysBefore = 7,
  daysAfter = 7,
): string[] {
  const dates: string[] = [];
  for (let offset = -daysBefore; offset <= daysAfter; offset += 1) {
    dates.push(format(addDays(anchor, offset), "yyyy-MM-dd"));
  }
  return dates;
}

export function formatNightOffScheduleLabel(dateYmd: string): string {
  return format(parseISO(dateYmd), "EEE, MMM d");
}

export function mergeNightOffScheduleEntries(
  rangeDates: string[],
  records: StaffDayOffScheduleRow[],
): NightOffScheduleEntry[] {
  const byDate = new Map(records.map((row) => [row.date, row]));
  return rangeDates.map((date) => {
    const record = byDate.get(date);
    return {
      date,
      is_night_off: !!record?.is_night_off,
      is_day_off: !!record?.is_day_off,
      recordId: record?.id,
    };
  });
}

export function staffIsScheduledOff(row?: Pick<StaffDayOffScheduleRow, "is_day_off" | "is_night_off"> | null): boolean {
  return !!(row?.is_day_off || row?.is_night_off);
}

export function shouldRemoveDayOffRecord(record: StaffDayOffScheduleRow): boolean {
  return (
    !record.is_day_off &&
    !record.is_night_off &&
    !record.is_sleeping_out &&
    !record.checked_out &&
    !record.checked_in
  );
}
