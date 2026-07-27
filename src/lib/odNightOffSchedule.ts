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

export function staffIsEligibleForOdOff(
  row?: Pick<StaffDayOffScheduleRow, "is_day_off" | "is_night_off"> | null,
  isSupportStaff = false,
): boolean {
  return isSupportStaff || staffIsScheduledOff(row);
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

/** OD tab = on-duty sign-in only. Off tab = sign-out + sign-in for scheduled off staff. */
export type OdCheckInOutContext = "on_duty" | "off_duty";

export type OdCheckInOutAction = "in" | "out" | "undo_in";

export type OdCheckInOutResult =
  | { kind: "insert"; record: OdCheckInOutInsert }
  | { kind: "update"; recordId: string; updates: OdCheckInOutUpdates }
  | { kind: "delete"; recordId: string }
  | { kind: "noop"; message: string }
  | { kind: "error"; message: string }
  | { kind: "late_override" };

export type OdCheckInOutInsert = {
  is_day_off: boolean;
  is_night_off: boolean;
  is_sleeping_out: boolean;
  checked_out: boolean;
  checked_in: boolean;
  checked_out_at?: string | null;
  checked_in_at?: string | null;
  checked_out_by?: string | null;
  checked_in_by?: string | null;
};

export type OdCheckInOutUpdates = Partial<OdCheckInOutInsert>;

export type OdCheckInOutOptions = {
  /** Male/Female Support bunks may sign out any night without a pre-set pattern. */
  isSupportStaff?: boolean;
};

export function resolveOdCheckInOut(
  context: OdCheckInOutContext,
  action: OdCheckInOutAction,
  existing: StaffDayOffScheduleRow | null | undefined,
  userId: string,
  nowIso = new Date().toISOString(),
  options?: OdCheckInOutOptions,
): OdCheckInOutResult {
  const isSupportStaff = options?.isSupportStaff ?? false;
  if (context === "on_duty") {
    if (action === "out") {
      return { kind: "error", message: "Sign out is only available on the Off tab" };
    }

    if (action === "undo_in") {
      if (!existing?.checked_in) {
        return { kind: "noop", message: "Not signed in" };
      }

      const afterUndo: StaffDayOffScheduleRow = {
        ...existing,
        checked_in: false,
        checked_in_at: null,
        checked_in_by: null,
      };

      if (shouldRemoveDayOffRecord(afterUndo)) {
        return { kind: "delete", recordId: existing.id };
      }

      return {
        kind: "update",
        recordId: existing.id,
        updates: {
          checked_in: false,
          checked_in_at: null,
          checked_in_by: null,
        },
      };
    }

    if (existing?.checked_in) {
      return { kind: "noop", message: "Already signed in for today" };
    }

    if (!existing) {
      return {
        kind: "insert",
        record: {
          is_day_off: false,
          is_night_off: false,
          is_sleeping_out: false,
          checked_out: false,
          checked_in: true,
          checked_in_at: nowIso,
          checked_in_by: userId,
        },
      };
    }

    return {
      kind: "update",
      recordId: existing.id,
      updates: {
        checked_in: true,
        checked_in_at: nowIso,
        checked_in_by: userId,
      },
    };
  }

  // Off tab: staff with day off / night off
  if (action === "undo_in") {
    if (!existing?.checked_in) {
      return { kind: "noop", message: "Not signed in" };
    }

    return {
      kind: "update",
      recordId: existing.id,
      updates: {
        checked_in: false,
        checked_in_at: null,
        checked_in_by: null,
      },
    };
  }

  if (action === "out") {
    if (!staffIsEligibleForOdOff(existing, isSupportStaff)) {
      return { kind: "late_override" };
    }

    if (!existing && isSupportStaff) {
      return {
        kind: "insert",
        record: {
          is_day_off: false,
          is_night_off: true,
          is_sleeping_out: false,
          checked_out: true,
          checked_out_at: nowIso,
          checked_out_by: userId,
          checked_in: false,
        },
      };
    }

    if (!existing) {
      return { kind: "late_override" };
    }

    if (existing.checked_out && existing.checked_in) {
      return { kind: "noop", message: "Already signed out and back in for today" };
    }

    if (existing.checked_out) {
      return { kind: "noop", message: "Already signed out" };
    }

    return {
      kind: "update",
      recordId: existing.id,
      updates: {
        checked_out: true,
        checked_out_at: nowIso,
        checked_out_by: userId,
      },
    };
  }

  // Sign in on Off tab
  if (!staffIsEligibleForOdOff(existing, isSupportStaff)) {
    return { kind: "error", message: "Please set day off first" };
  }

  if (!existing) {
    return { kind: "error", message: "Please sign out first" };
  }

  if (existing.checked_in) {
    return { kind: "noop", message: "Already signed in for today" };
  }

  return {
    kind: "update",
    recordId: existing.id,
    updates: {
      checked_in: true,
      checked_in_at: nowIso,
      checked_in_by: userId,
    },
  };
}

/** RFID: on-duty staff sign in; off-duty staff sign out then sign in. */
export function resolveOdRfidScan(
  existing: StaffDayOffScheduleRow | null | undefined,
  userId: string,
  nowIso = new Date().toISOString(),
  options?: OdCheckInOutOptions,
): OdCheckInOutResult {
  const isSupportStaff = options?.isSupportStaff ?? false;

  if (!staffIsEligibleForOdOff(existing, isSupportStaff)) {
    return resolveOdCheckInOut("on_duty", "in", existing, userId, nowIso, options);
  }

  if (!existing) {
    if (isSupportStaff) {
      return resolveOdCheckInOut("off_duty", "out", existing, userId, nowIso, options);
    }
    return { kind: "late_override" };
  }

  if (!existing.checked_out) {
    return resolveOdCheckInOut("off_duty", "out", existing, userId, nowIso, options);
  }

  if (!existing.checked_in) {
    return resolveOdCheckInOut("off_duty", "in", existing, userId, nowIso, options);
  }

  return { kind: "noop", message: "Already signed out and back in for today" };
}
