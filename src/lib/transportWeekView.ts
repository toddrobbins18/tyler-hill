import { camperEnrolledInWeek } from "@/lib/enrollmentWeekCalendar";
import { normCamperName } from "@/lib/transportGroupAttendance";
import { CAMP_LOCATION } from "@/lib/transportStopTimes";

export type CamperEnrollmentInfo = {
  enrolledWeeks?: number[];
  session?: string | null;
};

export type RouteStopLike = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  pickupTime: string;
  passengers: number;
  camperNames?: string[];
};

export type RouteLike = {
  id: number;
  name: string;
  bus: string;
  stops: RouteStopLike[];
  campers: number;
  capacity: number;
  departure: string;
  status: string;
  direction: string;
  color: string;
};

export function buildCamperEnrollmentLookup(
  roster: { name: string; enrolledWeeks?: number[]; session?: string | null }[],
): Map<string, CamperEnrollmentInfo> {
  const map = new Map<string, CamperEnrollmentInfo>();
  for (const c of roster) {
    map.set(normCamperName(c.name), {
      enrolledWeeks: c.enrolledWeeks,
      session: c.session,
    });
  }
  return map;
}

/** Rider names on a stop (supports legacy single-name stops). */
export function stopRiderNames(stop: Pick<RouteStopLike, "name" | "passengers" | "camperNames">): string[] {
  const names = (stop.camperNames ?? []).filter(Boolean);
  if (names.length > 0) return names;
  if ((stop.passengers ?? 0) > 0 && stop.name?.trim()) return [stop.name.trim()];
  return [];
}

export function camperEnrolledInWeekByLookup(
  lookup: Map<string, CamperEnrollmentInfo>,
  camperName: string,
  weekNumber: number,
  fallbackSession?: string | null,
): boolean {
  const info = lookup.get(normCamperName(camperName));
  if (info) {
    return camperEnrolledInWeek(info.enrolledWeeks, info.session, weekNumber);
  }
  if (fallbackSession != null) {
    return camperEnrolledInWeek(undefined, fallbackSession, weekNumber);
  }
  return true;
}

export function filterStopForEnrollmentWeek<T extends RouteStopLike>(
  stop: T,
  weekNumber: number,
  lookup: Map<string, CamperEnrollmentInfo>,
  campAddress: string = CAMP_LOCATION.address,
): T {
  if (stop.address === campAddress) return stop;

  const riders = stopRiderNames(stop);
  if (riders.length === 0) {
    return { ...stop, passengers: 0, camperNames: [] };
  }

  const filtered = riders.filter((name) => camperEnrolledInWeekByLookup(lookup, name, weekNumber));
  return {
    ...stop,
    camperNames: filtered,
    passengers: filtered.length,
  };
}

export function applyEnrollmentWeekToRoutes<T extends RouteLike>(
  routes: T[],
  weekNumber: number | null,
  lookup: Map<string, CamperEnrollmentInfo>,
  campAddress: string = CAMP_LOCATION.address,
): T[] {
  if (weekNumber == null) return routes;
  return routes.map((route) => {
    const stops = route.stops.map((s) =>
      filterStopForEnrollmentWeek(s, weekNumber, lookup, campAddress),
    );
    const campers = stops
      .filter((s) => s.address !== campAddress)
      .reduce((sum, s) => sum + (s.passengers || 0), 0);
    return { ...route, stops, campers };
  });
}

export function filterUnplottedForWeek<T extends { name: string; session?: string }>(
  campers: T[],
  weekNumber: number | null,
  lookup: Map<string, CamperEnrollmentInfo>,
): T[] {
  if (weekNumber == null) return campers;
  return campers.filter((c) =>
    camperEnrolledInWeekByLookup(lookup, c.name, weekNumber, c.session),
  );
}
