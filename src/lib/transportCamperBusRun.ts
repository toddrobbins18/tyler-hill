import { campersOnRoute } from "@/lib/transportBusAttendance";
import type { BubbleSheetCamper } from "@/lib/transportBubbleSheetPdf";
import {
  isParentTransportScheduledForRun,
  PARENT_TRANSPORT_STOP_LABEL,
  ridersOnRoute,
  type ParentTransportCamper,
} from "@/lib/transportParentTransport";
import { camperEnrolledInWeekByLookup } from "@/lib/transportWeekView";
import type { CamperEnrollmentInfo } from "@/lib/transportWeekView";
import type { TransportRouteStop } from "@/lib/transportRoster";

/** Which bus runs this camper uses on their assigned route (default: both). */
export type CamperBusRunMode = "both" | "am_only" | "pm_only";

export type CamperBusRunSchedules = Record<string, CamperBusRunMode>;

export const CAMPER_BUS_RUN_MODE_LABELS: Record<CamperBusRunMode, string> = {
  both: "Full day (AM & PM bus)",
  am_only: "Mini day / AM bus only",
  pm_only: "PM bus only",
};

export const CAMPER_BUS_RUN_MODE_OPTIONS: CamperBusRunMode[] = ["both", "am_only", "pm_only"];

export function normCamperBusRunKey(name: string): string {
  return name.trim().toLowerCase();
}

export function getCamperBusRunMode(
  schedules: CamperBusRunSchedules | undefined,
  camperName: string,
): CamperBusRunMode {
  return schedules?.[normCamperBusRunKey(camperName)] ?? "both";
}

export function camperScheduledForBusRun(
  mode: CamperBusRunMode | undefined,
  runPeriod: "am" | "pm",
): boolean {
  const m = mode ?? "both";
  if (m === "both") return true;
  if (m === "am_only") return runPeriod === "am";
  if (m === "pm_only") return runPeriod === "pm";
  return true;
}

export function formatCamperBusRunMode(mode: CamperBusRunMode | undefined): string {
  return CAMPER_BUS_RUN_MODE_LABELS[mode ?? "both"];
}

export type BusBubbleSheetRoute = {
  bus: string;
  routeName: string;
  campers: BubbleSheetCamper[];
};

/** Paper bus sheet: one row per camper on the route; fillable bubble or X per AM/PM run. */
export function buildBusBubbleSheetRoutes(options: {
  routes: { id: number; bus: string; routeName: string }[];
  baseCoreByRoute: (routeId: number) => TransportRouteStop[];
  coreForRun: (routeId: number, period: "am" | "pm") => TransportRouteStop[];
  schedules: CamperBusRunSchedules;
  runDate: string;
  parentTransportCampers?: ParentTransportCamper[];
  enrollmentWeek?: number | null;
  enrollmentLookup?: Map<string, CamperEnrollmentInfo>;
  includeCamper?: (name: string) => boolean;
}): BusBubbleSheetRoute[] {
  const {
    routes,
    baseCoreByRoute,
    coreForRun,
    schedules,
    runDate,
    parentTransportCampers = [],
    enrollmentWeek = null,
    enrollmentLookup,
    includeCamper,
  } = options;

  const riderBase = {
    runDate,
    enrollmentWeek,
    enrollmentLookup,
    busRunSchedules: schedules,
  };

  return routes
    .map((route) => {
      const baseCore = baseCoreByRoute(route.id);
      const amRiders = ridersOnRoute(route.id, coreForRun(route.id, "am"), parentTransportCampers, {
        ...riderBase,
        runPeriod: "am",
      });
      const pmRiders = ridersOnRoute(route.id, coreForRun(route.id, "pm"), parentTransportCampers, {
        ...riderBase,
        runPeriod: "pm",
      });
      const amNames = new Set(amRiders.map((r) => normCamperBusRunKey(r.name)));
      const pmNames = new Set(pmRiders.map((r) => normCamperBusRunKey(r.name)));

      const byKey = new Map<string, BubbleSheetCamper>();
      for (const c of campersOnRoute(route.id, baseCore)) {
        if (includeCamper && !includeCamper(c.name)) continue;
        const mode = getCamperBusRunMode(schedules, c.name);
        const key = normCamperBusRunKey(c.name);
        byKey.set(key, {
          name: c.name,
          detail: c.stopName,
          ridesAm: camperScheduledForBusRun(mode, "am") ? amNames.has(key) : false,
          ridesPm: camperScheduledForBusRun(mode, "pm") ? pmNames.has(key) : false,
        });
      }

      for (const rider of [...amRiders, ...pmRiders]) {
        if (includeCamper && !includeCamper(rider.name)) continue;
        const key = normCamperBusRunKey(rider.name);
        if (byKey.has(key)) continue;
        byKey.set(key, {
          name: rider.name,
          detail: rider.stopName,
          ridesAm: amNames.has(key),
          ridesPm: pmNames.has(key),
        });
      }

      const mergedCampers = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
      if (!mergedCampers.length) return null;
      return { bus: route.bus, routeName: route.routeName, campers: mergedCampers };
    })
    .filter((r): r is BusBubbleSheetRoute => r != null);
}

/** PT-only campers (no bus) for a Parent Transport roster PDF. */
export function buildPtOnlyBubbleSheetCampers(options: {
  parentTransportCampers: ParentTransportCamper[];
  runDate: string;
  enrollmentWeek?: number | null;
  enrollmentLookup?: Map<string, CamperEnrollmentInfo>;
  includeCamper?: (name: string) => boolean;
}): BubbleSheetCamper[] {
  const { parentTransportCampers, runDate, enrollmentWeek = null, enrollmentLookup, includeCamper } = options;
  const out: BubbleSheetCamper[] = [];
  for (const camper of parentTransportCampers) {
    if (camper.routeId != null) continue;
    if (includeCamper && !includeCamper(camper.name)) continue;
    if (
      enrollmentWeek != null &&
      enrollmentLookup &&
      !camperEnrolledInWeekByLookup(enrollmentLookup, camper.name, enrollmentWeek)
    ) {
      continue;
    }
    const ridesAm = isParentTransportScheduledForRun(camper, runDate, "am");
    const ridesPm = isParentTransportScheduledForRun(camper, runDate, "pm");
    if (!ridesAm && !ridesPm) continue;
    out.push({
      name: camper.name,
      detail: PARENT_TRANSPORT_STOP_LABEL,
      ridesAm,
      ridesPm,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
