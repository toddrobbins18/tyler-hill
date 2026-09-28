import { addDays, format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CAMP_TIMEZONE } from "@/lib/parentPortalCutoff";
import type { StaffTimeClockRow } from "@/lib/staffTimeClock";

export type OwlTimeSeasonSettings = {
  company_id: string;
  season: string;
  start_date: string;
  end_date: string;
  expected_sign_in_time: string;
  expected_sign_out_time: string;
};

export type OwlTimeClosedDate = {
  closed_date: string;
  label: string | null;
};

export type DayAttendanceStatus = "on_time" | "late" | "missing";

export type AttendanceSummaryRow = {
  staffId: string;
  staffName: string;
  scheduledDays: number;
  daysSignedIn: number;
  daysMissing: number;
  daysLate: number;
  daysOnTime: number;
  attendancePct: number;
  totalMinutesLate: number;
};

export type AttendanceDetailRow = {
  date: string;
  signedInAt: string | null;
  status: DayAttendanceStatus;
  minutesLate: number;
};

export type SignInOutHistoryRow = {
  date: string;
  signedInAt: string | null;
  signedOutAt: string | null;
  totalHours: number | null;
  isLate: boolean;
  minutesLate: number;
  isEarlyDeparture: boolean;
};

export function defaultOwlTimeSeasonRange(season: string): { start: string; end: string } {
  const year = /^\d{4}$/.test(String(season).trim())
    ? String(season).trim()
    : String(new Date().getFullYear());
  return { start: `${year}-06-29`, end: `${year}-08-14` };
}

export function defaultOwlTimeSettings(companyId: string, season: string): OwlTimeSeasonSettings {
  const { start, end } = defaultOwlTimeSeasonRange(season);
  return {
    company_id: companyId,
    season,
    start_date: start,
    end_date: end,
    expected_sign_in_time: "08:30:00",
    expected_sign_out_time: "16:00:00",
  };
}

export function listScheduledWorkDays(
  startDate: string,
  endDate: string,
  closedDates: string[],
): string[] {
  const closed = new Set(closedDates);
  const days: string[] = [];
  let cursor = parseISO(startDate);
  const end = parseISO(endDate);

  while (cursor <= end) {
    const dow = cursor.getDay();
    const dateStr = format(cursor, "yyyy-MM-dd");
    if (dow >= 1 && dow <= 5 && !closed.has(dateStr)) {
      days.push(dateStr);
    }
    cursor = addDays(cursor, 1);
  }

  return days;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function campLocalMinutesFromIso(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(iso));

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function minutesLate(signedInAt: string, expectedSignInTime: string): number {
  const actual = campLocalMinutesFromIso(signedInAt);
  const expected = parseTimeToMinutes(expectedSignInTime.slice(0, 5));
  return Math.max(0, actual - expected);
}

export function evaluateSignIn(
  signedInAt: string | null,
  expectedSignInTime: string,
): { status: DayAttendanceStatus; minutesLate: number } {
  if (!signedInAt) {
    return { status: "missing", minutesLate: 0 };
  }
  const late = minutesLate(signedInAt, expectedSignInTime);
  if (late > 0) {
    return { status: "late", minutesLate: late };
  }
  return { status: "on_time", minutesLate: 0 };
}

export function isEarlyDeparture(
  signedOutAt: string | null,
  expectedSignOutTime: string,
): boolean {
  if (!signedOutAt) return false;
  const actual = campLocalMinutesFromIso(signedOutAt);
  const expected = parseTimeToMinutes(expectedSignOutTime.slice(0, 5));
  return actual < expected;
}

export function hoursBetween(signIn: string, signOut: string): number {
  const ms = new Date(signOut).getTime() - new Date(signIn).getTime();
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function buildAttendanceSummary(
  staff: { id: string; name: string }[],
  scheduledDays: string[],
  punchesByStaffDate: Map<string, StaffTimeClockRow>,
  settings: Pick<OwlTimeSeasonSettings, "expected_sign_in_time">,
): AttendanceSummaryRow[] {
  return staff.map((person) => {
    let daysSignedIn = 0;
    let daysMissing = 0;
    let daysLate = 0;
    let daysOnTime = 0;
    let totalMinutesLate = 0;

    for (const date of scheduledDays) {
      const punch = punchesByStaffDate.get(`${person.id}:${date}`);
      const signedInAt = punch?.signed_in_at ?? null;
      const { status, minutesLate: dayLate } = evaluateSignIn(
        signedInAt,
        settings.expected_sign_in_time,
      );

      if (status === "missing") {
        daysMissing += 1;
      } else {
        daysSignedIn += 1;
        if (status === "late") {
          daysLate += 1;
          totalMinutesLate += dayLate;
        } else {
          daysOnTime += 1;
        }
      }
    }

    const scheduled = scheduledDays.length;
    const attendancePct = scheduled > 0 ? Math.round((daysSignedIn / scheduled) * 1000) / 10 : 0;

    return {
      staffId: person.id,
      staffName: person.name,
      scheduledDays: scheduled,
      daysSignedIn,
      daysMissing,
      daysLate,
      daysOnTime,
      attendancePct,
      totalMinutesLate,
    };
  });
}

export function buildAttendanceDetail(
  scheduledDays: string[],
  punchesByDate: Map<string, StaffTimeClockRow>,
  expectedSignInTime: string,
): AttendanceDetailRow[] {
  return scheduledDays.map((date) => {
    const punch = punchesByDate.get(date);
    const signedInAt = punch?.signed_in_at ?? null;
    const { status, minutesLate: dayLate } = evaluateSignIn(signedInAt, expectedSignInTime);
    return { date, signedInAt, status, minutesLate: dayLate };
  });
}

export function buildSignInOutHistory(
  scheduledDays: string[],
  punchesByDate: Map<string, StaffTimeClockRow>,
  settings: Pick<OwlTimeSeasonSettings, "expected_sign_in_time" | "expected_sign_out_time">,
): SignInOutHistoryRow[] {
  return scheduledDays
    .map((date) => {
      const punch = punchesByDate.get(date);
      const signedInAt = punch?.signed_in_at ?? null;
      const signedOutAt = punch?.signed_out_at ?? null;
      const { minutesLate: dayLate } = evaluateSignIn(signedInAt, settings.expected_sign_in_time);

      return {
        date,
        signedInAt,
        signedOutAt,
        totalHours:
          signedInAt && signedOutAt ? hoursBetween(signedInAt, signedOutAt) : null,
        isLate: dayLate > 0,
        minutesLate: dayLate,
        isEarlyDeparture: isEarlyDeparture(signedOutAt, settings.expected_sign_out_time),
      };
    })
    .filter((row) => row.signedInAt || row.signedOutAt);
}

export async function loadOwlTimeSeasonSettings(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<OwlTimeSeasonSettings> {
  const { data, error } = await supabase
    .from("owl_time_season_settings")
    .select("*")
    .eq("company_id", companyId)
    .eq("season", season)
    .maybeSingle();

  if (error) {
    console.error("[OwlTime] settings load failed:", error.message);
  }

  if (data) {
    return data as OwlTimeSeasonSettings;
  }

  return defaultOwlTimeSettings(companyId, season);
}

export async function loadOwlTimeClosedDates(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<OwlTimeClosedDate[]> {
  const { data, error } = await supabase
    .from("owl_time_closed_dates")
    .select("closed_date, label")
    .eq("company_id", companyId)
    .eq("season", season)
    .order("closed_date", { ascending: true });

  if (error) {
    console.error("[OwlTime] closed dates load failed:", error.message);
    return [];
  }

  return (data ?? []) as OwlTimeClosedDate[];
}

export async function saveOwlTimeSeasonSettings(
  supabase: SupabaseClient,
  settings: OwlTimeSeasonSettings,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from("owl_time_season_settings").upsert(
    {
      ...settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,season" },
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

export async function saveOwlTimeClosedDates(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  closedDates: OwlTimeClosedDate[],
): Promise<{ ok: boolean; message?: string }> {
  const { error: deleteError } = await supabase
    .from("owl_time_closed_dates")
    .delete()
    .eq("company_id", companyId)
    .eq("season", season);

  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  if (closedDates.length === 0) {
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("owl_time_closed_dates").insert(
    closedDates.map((row) => ({
      company_id: companyId,
      season,
      closed_date: row.closed_date,
      label: row.label,
    })),
  );

  if (insertError) {
    return { ok: false, message: insertError.message };
  }

  return { ok: true };
}

export async function loadSeasonStaff(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("season", season)
    .neq("status", "inactive")
    .order("name");

  if (error) {
    console.error("[OwlTime] staff load failed:", error.message);
    return [];
  }

  return (data ?? []) as { id: string; name: string }[];
}

export async function loadSeasonPunches(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  startDate: string,
  endDate: string,
): Promise<StaffTimeClockRow[]> {
  const { data, error } = await supabase
    .from("staff_time_clock")
    .select("*")
    .eq("company_id", companyId)
    .eq("season", season)
    .gte("work_date", startDate)
    .lte("work_date", endDate);

  if (error) {
    console.error("[OwlTime] punches load failed:", error.message);
    return [];
  }

  return (data ?? []) as StaffTimeClockRow[];
}

export function indexPunchesByStaffDate(
  punches: StaffTimeClockRow[],
): Map<string, StaffTimeClockRow> {
  const map = new Map<string, StaffTimeClockRow>();
  for (const punch of punches) {
    map.set(`${punch.staff_id}:${punch.work_date}`, punch);
  }
  return map;
}

export function indexPunchesByDateForStaff(
  punches: StaffTimeClockRow[],
  staffId: string,
): Map<string, StaffTimeClockRow> {
  const map = new Map<string, StaffTimeClockRow>();
  for (const punch of punches) {
    if (punch.staff_id === staffId) {
      map.set(punch.work_date, punch);
    }
  }
  return map;
}
