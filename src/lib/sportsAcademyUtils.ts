import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  format,
  parseISO,
  startOfDay,
} from "date-fns";

export type SportsAcademyChild = {
  id: string;
  name: string | null;
  age?: number | null;
  gender?: string | null;
  division_id?: string | null;
  division?: { id: string; name: string; gender?: string | null } | null;
};

export type SportsAcademyEnrollment = {
  id?: string;
  child_id: string;
  sport_name: string;
  instructor?: string | null;
  schedule_periods?: string[] | null;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: string[] | null;
  notes?: string | null;
  child?: SportsAcademyChild | null;
  children?: SportsAcademyChild | null;
  [key: string]: unknown;
};

export type SportsAcademyCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  enrollment: SportsAcademyEnrollment;
  eventDate: string;
};

const CHILD_BATCH_SIZE = 500;

export function normalizeSessionDateYmd(date: string | null | undefined): string | null {
  if (!date) return null;
  const trimmed = String(date).trim();
  if (!trimmed) return null;
  return trimmed.split("T")[0];
}

/** Legacy imports may still use a start/end range on one row. */
export function isLegacySportsAcademyRange(
  enrollment: Pick<SportsAcademyEnrollment, "start_date" | "end_date">,
): boolean {
  const start = normalizeSessionDateYmd(enrollment.start_date);
  const end = normalizeSessionDateYmd(enrollment.end_date);
  if (!start || !end) return false;
  return end !== start;
}

export function formatSportsAcademySessionDate(
  enrollment: Pick<SportsAcademyEnrollment, "start_date" | "end_date">,
): string {
  const start = normalizeSessionDateYmd(enrollment.start_date);
  const end = normalizeSessionDateYmd(enrollment.end_date);
  if (!start && !end) return "No session date";

  const fmt = (ymd: string) =>
    new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US");

  if (start && isLegacySportsAcademyRange(enrollment) && end) {
    return `${fmt(start)} - ${fmt(end)}`;
  }

  return fmt(start || end!);
}

export function buildSportsAcademySessionDates(sessionDate: string | null | undefined): {
  start_date: string | null;
  end_date: string | null;
} {
  const normalized = normalizeSessionDateYmd(sessionDate);
  return {
    start_date: normalized,
    end_date: normalized,
  };
}

/** Prefer roster `name`; tolerate empty strings from imports. */
export function sportsAcademyCamperName(enrollment: SportsAcademyEnrollment): string {
  const child = enrollment.child ?? enrollment.children;
  const name = String(child?.name ?? "").trim();
  return name || "Unknown";
}

export function enrollmentMatchesSpecialistSports(
  enrollment: SportsAcademyEnrollment,
  assignedSports: string[] | null,
): boolean {
  if (!assignedSports || assignedSports.length === 0) return true;
  return assignedSports.includes(enrollment.sport_name);
}

/** Load camper rows separately so names resolve even when PostgREST embeds are blocked by RLS. */
export async function enrichSportsAcademyEnrollments(
  client: SupabaseClient,
  enrollments: SportsAcademyEnrollment[],
  companyId: string,
  season: string,
): Promise<SportsAcademyEnrollment[]> {
  if (enrollments.length === 0) return [];

  const childIds = Array.from(new Set(enrollments.map((e) => e.child_id).filter(Boolean)));
  const childMap = new Map<string, SportsAcademyChild>();

  for (let i = 0; i < childIds.length; i += CHILD_BATCH_SIZE) {
    const batch = childIds.slice(i, i + CHILD_BATCH_SIZE);
    const { data, error } = await client
      .from("children")
      .select("id, name, age, gender, division_id, division:divisions(id, name, gender)")
      .eq("company_id", companyId)
      .eq("season", season)
      .in("id", batch);

    if (error) throw error;
    (data || []).forEach((row) => {
      childMap.set(row.id, row as SportsAcademyChild);
    });
  }

  return enrollments.map((enrollment) => {
    const embedded = enrollment.child ?? enrollment.children;
    const embeddedName = String(embedded?.name ?? "").trim();
    const resolved = embeddedName ? embedded : childMap.get(enrollment.child_id) ?? embedded ?? null;
    return {
      ...enrollment,
      child: resolved,
      children: resolved,
    };
  });
}

function matchesWeekdayFilter(enrollment: SportsAcademyEnrollment, day: Date): boolean {
  const weekdays = (enrollment.weekdays || []).filter(Boolean);
  if (weekdays.length === 0) return true;
  return weekdays.includes(format(day, "EEEE"));
}

/** True when an enrollment should appear on a calendar day. */
export function enrollmentOccursOnDate(
  enrollment: SportsAcademyEnrollment,
  date: Date,
): boolean {
  if (!enrollment.start_date) return false;

  const day = startOfDay(date);
  const start = startOfDay(parseISO(normalizeSessionDateYmd(enrollment.start_date)!));

  if (!isLegacySportsAcademyRange(enrollment)) {
    return day.getTime() === start.getTime() && matchesWeekdayFilter(enrollment, day);
  }

  const end = startOfDay(parseISO(normalizeSessionDateYmd(enrollment.end_date)!));
  if (day < start || day > end) return false;
  return matchesWeekdayFilter(enrollment, day);
}

/** Expand enrollments into all-day calendar events within an optional visible range. */
export function expandSportsAcademyCalendarEvents(
  enrollments: SportsAcademyEnrollment[],
  rangeStart?: Date,
  rangeEnd?: Date,
): SportsAcademyCalendarEvent[] {
  const events: SportsAcademyCalendarEvent[] = [];

  for (const enrollment of enrollments) {
    if (!enrollment.start_date || !enrollment.id) continue;

    const enrollmentStart = startOfDay(parseISO(normalizeSessionDateYmd(enrollment.start_date)!));
    const enrollmentEnd = isLegacySportsAcademyRange(enrollment)
      ? startOfDay(parseISO(normalizeSessionDateYmd(enrollment.end_date)!))
      : enrollmentStart;

    const intervalStart =
      rangeStart && rangeStart > enrollmentStart ? rangeStart : enrollmentStart;
    const intervalEnd =
      rangeEnd && rangeEnd < enrollmentEnd ? rangeEnd : enrollmentEnd;

    if (intervalStart > intervalEnd) continue;

    const days = eachDayOfInterval({ start: intervalStart, end: intervalEnd });
    const camperName = sportsAcademyCamperName(enrollment);
    const periods =
      enrollment.schedule_periods?.length
        ? ` (${enrollment.schedule_periods.join(", ")})`
        : "";

    for (const day of days) {
      if (!enrollmentOccursOnDate(enrollment, day)) continue;

      const eventDate = format(day, "yyyy-MM-dd");
      events.push({
        id: `${enrollment.id}-${eventDate}`,
        title: `${camperName} — ${enrollment.sport_name}${periods}`,
        start: startOfDay(day),
        end: endOfDay(day),
        allDay: true,
        enrollment,
        eventDate,
      });
    }
  }

  return events.sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title),
  );
}

/** Visible calendar window with a small buffer for month/week navigation. */
export function sportsAcademyCalendarRange(
  anchorDate: Date,
  calendarView: "month" | "week" | "day" | "agenda",
): { start: Date; end: Date } {
  if (calendarView === "day") {
    return { start: startOfDay(anchorDate), end: endOfDay(anchorDate) };
  }

  if (calendarView === "week") {
    return {
      start: startOfDay(addDays(anchorDate, -7)),
      end: endOfDay(addDays(anchorDate, 7)),
    };
  }

  return {
    start: startOfDay(addDays(anchorDate, -42)),
    end: endOfDay(addDays(anchorDate, 42)),
  };
}
