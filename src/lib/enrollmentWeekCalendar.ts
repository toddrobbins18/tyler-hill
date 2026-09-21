import { addDays, format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_CAMP_ENROLLMENT_WEEKS, resolveEnrolledWeeks } from "@/lib/enrolledWeeks";

export type EnrollmentWeekRow = {
  weekNumber: number;
  startDate: string;
  endDate: string;
};

export type EnrollmentWeekCalendar = EnrollmentWeekRow[];

export function camperEnrolledInWeek(
  enrolledWeeks: number[] | null | undefined,
  session: string | null | undefined,
  weekNumber: number,
): boolean {
  return resolveEnrolledWeeks(enrolledWeeks, session).includes(weekNumber);
}

export function enrollmentWeekForDate(
  calendar: EnrollmentWeekCalendar,
  date: string,
): number | null {
  for (const row of calendar) {
    if (date >= row.startDate && date <= row.endDate) return row.weekNumber;
  }
  return null;
}

export function getEnrollmentWeekRow(
  calendar: EnrollmentWeekCalendar,
  weekNumber: number,
): EnrollmentWeekRow | null {
  return calendar.find((row) => row.weekNumber === weekNumber) ?? null;
}

/** Prefer saved calendar rows; fall back to unsaved draft rows for display/print preview. */
export function resolveEnrollmentWeekRow(
  saved: EnrollmentWeekCalendar,
  draft: EnrollmentWeekCalendar,
  weekNumber: number,
): { row: EnrollmentWeekRow | null; source: "saved" | "draft" | null } {
  const savedRow = getEnrollmentWeekRow(saved, weekNumber);
  if (savedRow?.startDate && savedRow?.endDate) {
    return { row: savedRow, source: "saved" };
  }
  const draftRow = getEnrollmentWeekRow(draft, weekNumber);
  if (draftRow?.startDate && draftRow?.endDate) {
    return { row: { ...draftRow, weekNumber }, source: "draft" };
  }
  return { row: null, source: null };
}

export function mergeEnrollmentWeekCalendars(
  saved: EnrollmentWeekCalendar,
  draft: EnrollmentWeekCalendar,
): EnrollmentWeekCalendar {
  const rows: EnrollmentWeekRow[] = [];
  for (let weekNumber = 1; weekNumber <= DAY_CAMP_ENROLLMENT_WEEKS; weekNumber++) {
    const resolved = resolveEnrollmentWeekRow(saved, draft, weekNumber);
    if (resolved.row) rows.push(resolved.row);
  }
  return rows;
}

export function formatEnrollmentWeekRange(row: EnrollmentWeekRow): string {
  const start = parseISO(row.startDate);
  const end = parseISO(row.endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFmt = format(start, sameYear ? "MMM d" : "MMM d, yyyy");
  const endFmt = format(end, "MMM d, yyyy");
  return `${startFmt} – ${endFmt}`;
}

export function formatEnrollmentWeekLabel(
  weekNumber: number,
  calendar: EnrollmentWeekCalendar,
): string {
  const row = getEnrollmentWeekRow(calendar, weekNumber);
  if (!row) return `Week ${weekNumber}`;
  return `Week ${weekNumber} (${formatEnrollmentWeekRange(row)})`;
}

/** Build 8 Mon–Fri blocks starting from the given Week 1 start date. */
export function buildMonFriEnrollmentWeeks(week1StartDate: string): EnrollmentWeekCalendar {
  const weeks: EnrollmentWeekCalendar = [];
  let cursor = parseISO(week1StartDate);
  for (let weekNumber = 1; weekNumber <= DAY_CAMP_ENROLLMENT_WEEKS; weekNumber++) {
    const startDate = format(cursor, "yyyy-MM-dd");
    const endDate = format(addDays(cursor, 4), "yyyy-MM-dd");
    weeks.push({ weekNumber, startDate, endDate });
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function isEnrollmentWeekCalendarComplete(calendar: EnrollmentWeekCalendar): boolean {
  if (calendar.length !== DAY_CAMP_ENROLLMENT_WEEKS) return false;
  return calendar.every((row) => row.startDate && row.endDate && row.endDate >= row.startDate);
}

export async function loadEnrollmentWeekCalendar(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<EnrollmentWeekCalendar> {
  const { data, error } = await supabase
    .from("day_camp_enrollment_weeks" as "profiles")
    .select("week_number, start_date, end_date")
    .eq("company_id", companyId)
    .eq("season", season)
    .order("week_number");

  if (error) {
    console.error("[EnrollmentWeekCalendar] Load failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    weekNumber: (row as { week_number: number }).week_number,
    startDate: (row as { start_date: string }).start_date,
    endDate: (row as { end_date: string }).end_date,
  }));
}

export async function saveEnrollmentWeekCalendar(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  calendar: EnrollmentWeekCalendar,
): Promise<boolean> {
  const rows = calendar
    .filter((row) => row.startDate && row.endDate)
    .map((row) => ({
      company_id: companyId,
      season,
      week_number: row.weekNumber,
      start_date: row.startDate,
      end_date: row.endDate,
    }));

  if (!rows.length) return false;

  const { error: deleteError } = await supabase
    .from("day_camp_enrollment_weeks" as "profiles")
    .delete()
    .eq("company_id", companyId)
    .eq("season", season);

  if (deleteError) {
    console.error("[EnrollmentWeekCalendar] Clear failed:", deleteError.message);
    return false;
  }

  const { error } = await supabase.from("day_camp_enrollment_weeks" as "profiles").insert(rows as never);
  if (error) {
    console.error("[EnrollmentWeekCalendar] Save failed:", error.message);
    return false;
  }
  return true;
}

export function groupRosterByTeam<T extends { groupName: string }>(roster: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const camper of roster) {
    const list = map.get(camper.groupName) ?? [];
    list.push(camper);
    map.set(camper.groupName, list);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}
