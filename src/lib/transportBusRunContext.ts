import type { SupabaseClient } from "@supabase/supabase-js";
import type { TransportRouteStop } from "@/lib/transportDailyOverrides";
import {
  buildCamperEnrollmentLookup,
  camperEnrolledInWeekByLookup,
  type CamperEnrollmentInfo,
} from "@/lib/transportWeekView";
import { campersOnRoute } from "@/lib/transportBusAttendance";
import { loadGroupRoster } from "@/lib/transportGroupAttendance";
import {
  configuredEnrollmentWeekRows,
  defaultEnrollmentWeekForDate,
  enrollmentWeekDayColumns,
  enrollmentWeekForDate,
  formatEnrollmentWeekLabel,
  formatEnrollmentWeekRange,
  getEnrollmentWeekRow,
  loadEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
  type EnrollmentWeekDayColumn,
  type EnrollmentWeekRow,
} from "@/lib/enrollmentWeekCalendar";

export type BusRunEnrollmentContext = {
  calendar: EnrollmentWeekCalendar;
  /** Week number when run date falls inside a configured range. */
  enrollmentWeek: number | null;
  /** Best week for roster/print when run date is outside ranges (nearest configured week). */
  defaultWeek: number | null;
  configuredWeeks: EnrollmentWeekRow[];
  weekLabel: string | null;
  weekDateRange: string | null;
  weekDays: EnrollmentWeekDayColumn[];
  enrollmentLookup: Map<string, CamperEnrollmentInfo>;
};

export async function loadBusRunEnrollmentContext(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  runDate: string,
): Promise<BusRunEnrollmentContext> {
  const [calendar, roster] = await Promise.all([
    loadEnrollmentWeekCalendar(supabase, companyId, season),
    loadGroupRoster(supabase, companyId, season),
  ]);

  const enrollmentWeek = enrollmentWeekForDate(calendar, runDate);
  const defaultWeek = defaultEnrollmentWeekForDate(calendar, runDate);
  const weekRow = defaultWeek != null ? getEnrollmentWeekRow(calendar, defaultWeek) : null;

  return {
    calendar,
    enrollmentWeek,
    defaultWeek,
    configuredWeeks: configuredEnrollmentWeekRows(calendar),
    weekLabel: defaultWeek != null ? formatEnrollmentWeekLabel(defaultWeek, calendar) : null,
    weekDateRange: weekRow ? formatEnrollmentWeekRange(weekRow) : null,
    weekDays: enrollmentWeekDayColumns(weekRow),
    enrollmentLookup: buildCamperEnrollmentLookup(roster),
  };
}

export function weekContextForNumber(
  calendar: EnrollmentWeekCalendar,
  weekNumber: number,
): {
  weekRow: EnrollmentWeekRow | null;
  weekLabel: string;
  weekDateRange: string | null;
  weekDays: EnrollmentWeekDayColumn[];
} {
  const weekRow = getEnrollmentWeekRow(calendar, weekNumber);
  return {
    weekRow,
    weekLabel: formatEnrollmentWeekLabel(weekNumber, calendar),
    weekDateRange: weekRow ? formatEnrollmentWeekRange(weekRow) : null,
    weekDays: enrollmentWeekDayColumns(weekRow),
  };
}

export function campersOnRouteForWeek(
  routeId: number,
  coreStops: TransportRouteStop[],
  enrollmentWeek: number | null,
  enrollmentLookup: Map<string, CamperEnrollmentInfo>,
) {
  const all = campersOnRoute(routeId, coreStops);
  if (enrollmentWeek == null) return all;
  return all.filter((c) =>
    camperEnrolledInWeekByLookup(enrollmentLookup, c.name, enrollmentWeek),
  );
}

/** Mon–Fri with AM and PM bubble columns for weekly bus sheets. */
export function buildBusWeekAmPmColumns(weekDays: EnrollmentWeekDayColumn[]): EnrollmentWeekDayColumn[] {
  const out: EnrollmentWeekDayColumn[] = [];
  for (const day of weekDays.slice(0, 5)) {
    out.push({
      label: day.label,
      sublabel: day.sublabel ? `${day.sublabel} AM` : "AM",
    });
    out.push({
      label: day.label,
      sublabel: day.sublabel ? `${day.sublabel} PM` : "PM",
    });
  }
  return out;
}
