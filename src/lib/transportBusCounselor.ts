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
  groupAttendanceOnly: boolean;
  assignedGroups: string[];
};

export async function loadUserBusCounselorProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<BusCounselorProfile> {
  const empty: BusCounselorProfile = {
    busAttendanceOnly: false,
    assignedTransportBus: null,
    groupAttendanceOnly: false,
    assignedGroups: [],
  };
  const { data, error } = await supabase
    .from("profiles")
    .select("bus_attendance_only, assigned_transport_bus")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Transport] Load bus counselor profile failed:", error.message);
    return empty;
  }

  const row = data as {
    bus_attendance_only?: boolean | null;
    assigned_transport_bus?: string | null;
  } | null;

  const groupResult = await supabase
    .from("profiles")
    .select("group_attendance_only, assigned_groups")
    .eq("id", userId)
    .maybeSingle();
  const groupRow = groupResult.error
    ? null
    : (groupResult.data as {
        group_attendance_only?: boolean | null;
        assigned_groups?: string[] | null;
      } | null);

  return {
    busAttendanceOnly: !!row?.bus_attendance_only,
    assignedTransportBus: row?.assigned_transport_bus?.trim() || null,
    groupAttendanceOnly: !!groupRow?.group_attendance_only,
    assignedGroups: (groupRow?.assigned_groups ?? []).map((name) => name.trim()).filter(Boolean),
  };
}

export function isBusCounselorMenuAllowed(menuId: string): boolean {
  return BUS_COUNSELOR_NAV_MENU_IDS.has(menuId);
}

export const GROUP_COUNSELOR_NAV_MENU_IDS = new Set(["group-attendance"]);

export function paperlessNavMenuIds(options: {
  busAttendanceOnly: boolean;
  groupAttendanceOnly: boolean;
}): Set<string> | null {
  if (!options.busAttendanceOnly && !options.groupAttendanceOnly) return null;
  const ids = new Set<string>();
  if (options.busAttendanceOnly) {
    for (const id of BUS_COUNSELOR_NAV_MENU_IDS) ids.add(id);
  }
  if (options.groupAttendanceOnly) {
    for (const id of GROUP_COUNSELOR_NAV_MENU_IDS) ids.add(id);
  }
  return ids;
}

export function isPaperlessNavLocked(options: {
  canViewAll: boolean;
  busAttendanceOnly: boolean;
  groupAttendanceOnly: boolean;
}): boolean {
  return !options.canViewAll && (!!options.busAttendanceOnly || !!options.groupAttendanceOnly);
}

export function isPaperlessMenuAllowed(
  menuId: string,
  options: { busAttendanceOnly: boolean; groupAttendanceOnly: boolean },
): boolean {
  const ids = paperlessNavMenuIds(options);
  if (!ids) return true;
  return ids.has(menuId);
}

export function paperlessHomePath(options: {
  busAttendanceOnly: boolean;
  groupAttendanceOnly: boolean;
}): string {
  if (options.busAttendanceOnly) return "/day-camp/bus-attendance";
  if (options.groupAttendanceOnly) return "/day-camp/group-attendance";
  return "/day-camp/bus-attendance";
}

export function filterGroupNamesForCounselor(
  groups: string[],
  assignedGroups: string[] | null | undefined,
  options: { groupAttendanceOnly: boolean; canViewAll: boolean },
): string[] {
  if (options.canViewAll || !options.groupAttendanceOnly) return groups;
  const wanted = new Set(
    (assignedGroups ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  if (wanted.size === 0) return [];
  return groups.filter((name) => wanted.has(name.trim().toLowerCase()));
}

export function camperGroupAllowed(
  groupName: string,
  assignedGroups: string[] | null | undefined,
  options: { groupAttendanceOnly: boolean; canViewAll: boolean },
): boolean {
  if (options.canViewAll || !options.groupAttendanceOnly) return true;
  const wanted = new Set(
    (assignedGroups ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean),
  );
  if (wanted.size === 0) return false;
  return wanted.has(groupName.trim().toLowerCase());
}

export function filterCampersForGroupCounselor<T extends { groupName: string }>(
  campers: T[],
  assignedGroups: string[] | null | undefined,
  options: { groupAttendanceOnly: boolean; canViewAll: boolean },
): T[] {
  if (options.canViewAll || !options.groupAttendanceOnly) return campers;
  return campers.filter((camper) => camperGroupAllowed(camper.groupName, assignedGroups, options));
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
