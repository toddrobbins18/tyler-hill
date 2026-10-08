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
  if (fallbackSession != null && String(fallbackSession).trim()) {
    return camperEnrolledInWeek(undefined, fallbackSession, weekNumber);
  }
  return false;
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

/** Remove riders not on the active season roster (e.g. 2026 MapPoint names on a 2027 board). */
export function filterStopToSeasonRoster<T extends RouteStopLike>(
  stop: T,
  seasonRosterNames: Set<string>,
  campAddress: string = CAMP_LOCATION.address,
): T {
  if (stop.address === campAddress) return stop;

  const riders = stopRiderNames(stop).filter((name) => seasonRosterNames.has(normCamperName(name)));
  const primaryLabel =
    riders[0] ?? (stop.address.split(",")[0]?.trim() || stop.name || stop.address);
  return {
    ...stop,
    name: primaryLabel,
    camperNames: riders,
    passengers: riders.length,
  };
}

export function applySeasonRosterToRoutes<T extends RouteLike>(
  routes: T[],
  seasonRosterNames: Set<string>,
  campAddress: string = CAMP_LOCATION.address,
): T[] {
  const filtered = routes.map((route) => {
    const stops = route.stops.map((s) => filterStopToSeasonRoster(s, seasonRosterNames, campAddress));
    const campers = stops
      .filter((s) => s.address !== campAddress)
      .reduce((sum, s) => sum + (s.passengers || 0), 0);
    return { ...route, stops, campers };
  });
  return pruneRouteStopsWithNoRiders(filtered, campAddress);
}

/** Drop passenger stops with no riders after enrollment filter (keeps camp). */
export function pruneRouteStopsWithNoRiders<T extends RouteLike>(
  routes: T[],
  campAddress: string = CAMP_LOCATION.address,
): T[] {
  return routes.map((route) => {
    const stops = route.stops.filter((s) => {
      if (s.address === campAddress) return true;
      return (s.passengers ?? 0) > 0 || (s.camperNames?.length ?? 0) > 0;
    });
    const campers = stops
      .filter((s) => s.address !== campAddress)
      .reduce((sum, s) => sum + (s.passengers || 0), 0);
    return { ...route, stops, campers };
  });
}

export function applyEnrollmentWeekToRoutes<T extends RouteLike>(
  routes: T[],
  weekNumber: number | null,
  lookup: Map<string, CamperEnrollmentInfo>,
  campAddress: string = CAMP_LOCATION.address,
): T[] {
  if (weekNumber == null) return routes;
  const filtered = routes.map((route) => {
    const stops = route.stops.map((s) =>
      filterStopForEnrollmentWeek(s, weekNumber, lookup, campAddress),
    );
    const campers = stops
      .filter((s) => s.address !== campAddress)
      .reduce((sum, s) => sum + (s.passengers || 0), 0);
    return { ...route, stops, campers };
  });
  return pruneRouteStopsWithNoRiders(filtered, campAddress);
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

export function filterUnplottedToSeasonRoster<T extends { name: string }>(
  campers: T[],
  seasonRosterNames: Set<string>,
): T[] {
  return campers.filter((c) => seasonRosterNames.has(normCamperName(c.name)));
}
