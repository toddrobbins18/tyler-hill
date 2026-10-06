import { format, parseISO } from "date-fns";
import { camperEnrolledInWeekByLookup, type CamperEnrollmentInfo } from "@/lib/transportWeekView";
import { attendanceRecordKey, campersOnRoute } from "@/lib/transportBusAttendance";
import type { TransportRouteStop } from "@/lib/transportRoster";

export type ParentTransportWeekday = "mon" | "tue" | "wed" | "thu" | "fri";

export const PARENT_TRANSPORT_WEEKDAYS: ParentTransportWeekday[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
];

export const PARENT_TRANSPORT_STOP_LABEL = "Parent Transport (PT)";

export type ParentTransportCamper = {
  id: number;
  childId?: string | null;
  name: string;
  routeId: number;
  /** Parent drop-off — counts on AM bus roster when scheduled. */
  am: boolean;
  /** Parent pick-up — counts on PM bus roster when scheduled. */
  pm: boolean;
  /** Empty = every weekday the camper attends camp. */
  weekdays: ParentTransportWeekday[];
  notes?: string | null;
};

export type RouteRider = {
  key: string;
  name: string;
  stopName: string;
  isParentTransport: boolean;
};

const normName = (name: string) => name.trim().toLowerCase();

export function stableParentTransportId(seed: string, fallback: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const n = Math.abs(h);
  return n > 0 ? n : fallback;
}

export function weekdayFromRunDate(runDate: string): ParentTransportWeekday | null {
  try {
    const day = format(parseISO(runDate), "EEE").toLowerCase();
    if (PARENT_TRANSPORT_WEEKDAYS.includes(day as ParentTransportWeekday)) {
      return day as ParentTransportWeekday;
    }
  } catch {
    // ignore invalid dates
  }
  return null;
}

export function isParentTransportScheduledForRun(
  camper: Pick<ParentTransportCamper, "am" | "pm" | "weekdays">,
  runDate: string,
  runPeriod: "am" | "pm",
): boolean {
  if (runPeriod === "am" && !camper.am) return false;
  if (runPeriod === "pm" && !camper.pm) return false;

  const weekdays = camper.weekdays ?? [];
  if (weekdays.length === 0) return true;

  const weekday = weekdayFromRunDate(runDate);
  return weekday != null && weekdays.includes(weekday);
}

export function parentTransportNamesSet(
  campers: ParentTransportCamper[],
): Set<string> {
  return new Set(campers.map((c) => normName(c.name)));
}

/** Remove PT campers from the unplotted pool — they belong on the PT tab. */
export function filterUnplottedExcludingParentTransport<T extends { name: string }>(
  unplotted: T[],
  parentTransport: ParentTransportCamper[],
): T[] {
  const ptNames = parentTransportNamesSet(parentTransport);
  if (ptNames.size === 0) return unplotted;
  return unplotted.filter((c) => !ptNames.has(normName(c.name)));
}

export function parentTransportRidersForRoute(
  routeId: number,
  parentTransport: ParentTransportCamper[],
  options: {
    runDate: string;
    runPeriod: "am" | "pm";
    enrollmentWeek?: number | null;
    enrollmentLookup?: Map<string, CamperEnrollmentInfo>;
  },
): RouteRider[] {
  const { runDate, runPeriod, enrollmentWeek = null, enrollmentLookup } = options;

  return parentTransport
    .filter((c) => c.routeId === routeId)
    .filter((c) => isParentTransportScheduledForRun(c, runDate, runPeriod))
    .filter((c) => {
      if (enrollmentWeek == null || !enrollmentLookup) return true;
      return camperEnrolledInWeekByLookup(enrollmentLookup, c.name, enrollmentWeek);
    })
    .map((c) => ({
      key: attendanceRecordKey(routeId, c.name),
      name: c.name,
      stopName: PARENT_TRANSPORT_STOP_LABEL,
      isParentTransport: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Bus stop riders plus parent-transport riders assigned to the same route. */
export function ridersOnRoute(
  routeId: number,
  coreStops: TransportRouteStop[],
  parentTransport: ParentTransportCamper[],
  options: {
    runDate: string;
    runPeriod: "am" | "pm";
    enrollmentWeek?: number | null;
    enrollmentLookup?: Map<string, CamperEnrollmentInfo>;
  },
): RouteRider[] {
  const busRiders = campersOnRoute(routeId, coreStops).map((r) => ({
    ...r,
    isParentTransport: false,
  }));

  const ptRiders = parentTransportRidersForRoute(routeId, parentTransport, options);

  const seen = new Set(busRiders.map((r) => r.key));
  const merged = [...busRiders];
  for (const rider of ptRiders) {
    if (seen.has(rider.key)) continue;
    seen.add(rider.key);
    merged.push(rider);
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function countParentTransportOnRoute(
  routeId: number,
  parentTransport: ParentTransportCamper[],
  options: {
    runDate: string;
    runPeriod: "am" | "pm";
    enrollmentWeek?: number | null;
    enrollmentLookup?: Map<string, CamperEnrollmentInfo>;
  },
): number {
  return parentTransportRidersForRoute(routeId, parentTransport, options).length;
}

export function formatParentTransportSchedule(
  camper: Pick<ParentTransportCamper, "am" | "pm" | "weekdays">,
): string {
  const runs = [
    camper.am ? "AM drop-off" : null,
    camper.pm ? "PM pick-up" : null,
  ].filter(Boolean);
  const runLabel = runs.length ? runs.join(" · ") : "No runs";

  const weekdays = camper.weekdays ?? [];
  const dayLabel =
    weekdays.length === 0
      ? "Every camp day"
      : weekdays.map((d) => d.slice(0, 3).toUpperCase()).join(", ");

  return `${runLabel} · ${dayLabel}`;
}
