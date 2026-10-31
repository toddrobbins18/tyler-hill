import type { SupabaseClient } from "@supabase/supabase-js";

/** Normalize bus labels ("Bus 1", "1", "bus 1") for comparison. */
export function normalizeTransportBusKey(bus: string): string {
  const trimmed = bus.trim();
  const match = trimmed.match(/bus\s*(\d+)/i) ?? trimmed.match(/^(\d+)$/);
  if (match) return `bus ${match[1]}`.toLowerCase();
  return trimmed.toLowerCase();
}

export function transportBusesMatch(a: string, b: string): boolean {
  return normalizeTransportBusKey(a) === normalizeTransportBusKey(b);
}

/** Menu items bus counselors may open when navigation is locked to their assigned bus. */
export const BUS_COUNSELOR_NAV_MENU_IDS = new Set([
  "bus-attendance",
  "bus-check-ins",
]);

/** Full transport board — not granted by generic "transportation" alone (Todd: counselors see one bus). */
export function canViewAllTransportBuses(options: {
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  hasTransportAdmin?: boolean;
}): boolean {
  return !!(options.isSuperAdmin || options.isAdmin || options.hasTransportAdmin);
}

export function isBusCounselorNavLocked(options: {
  canViewAll: boolean;
  busAttendanceOnly: boolean;
}): boolean {
  return !options.canViewAll && options.busAttendanceOnly;
}

export type BusCounselorProfile = {
  busAttendanceOnly: boolean;
  assignedTransportBus: string | null;
};

export async function loadUserBusCounselorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<BusCounselorProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("bus_attendance_only, assigned_transport_bus")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Transport] Load bus counselor profile failed:", error.message);
    return { busAttendanceOnly: false, assignedTransportBus: null };
  }

  const row = data as {
    bus_attendance_only?: boolean | null;
    assigned_transport_bus?: string | null;
  } | null;

  return {
    busAttendanceOnly: !!row?.bus_attendance_only,
    assignedTransportBus: row?.assigned_transport_bus?.trim() || null,
  };
}

export function isBusCounselorMenuAllowed(menuId: string): boolean {
  return BUS_COUNSELOR_NAV_MENU_IDS.has(menuId);
}

export function filterRoutesForAssignedBus<T extends { bus: string }>(
  routes: T[],
  options: {
    assignedBus: string | null | undefined;
    canViewAll: boolean;
    /** Transportation coordinators without an assigned bus still see all routes. */
    hasTransportCoordinatorAccess?: boolean;
    /** Paperless bus counselor — always scoped to assigned bus. */
    busAttendanceOnly?: boolean;
  },
): T[] {
  const { assignedBus, canViewAll, hasTransportCoordinatorAccess, busAttendanceOnly } = options;
  if (canViewAll) return routes;
  const bus = assignedBus?.trim();
  if (busAttendanceOnly) {
    if (!bus) return [];
    return routes.filter((r) => transportBusesMatch(r.bus, bus));
  }
  if (bus) return routes.filter((r) => transportBusesMatch(r.bus, bus));
  if (hasTransportCoordinatorAccess) return routes;
  return [];
}

export async function loadUserAssignedTransportBus(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const profile = await loadUserBusCounselorProfile(supabase, userId);
  return profile.assignedTransportBus;
}
