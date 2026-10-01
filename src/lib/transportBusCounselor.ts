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

export function canViewAllTransportBuses(options: {
  isSuperAdmin?: boolean;
  isAdmin?: boolean;
  hasTransportAdmin?: boolean;
  hasTransportation?: boolean;
}): boolean {
  return !!(
    options.isSuperAdmin ||
    options.isAdmin ||
    options.hasTransportAdmin ||
    options.hasTransportation
  );
}

export function filterRoutesForAssignedBus<T extends { bus: string }>(
  routes: T[],
  assignedBus: string | null | undefined,
  canViewAll: boolean,
): T[] {
  if (canViewAll) return routes;
  const bus = assignedBus?.trim();
  if (!bus) return routes;
  return routes.filter((r) => transportBusesMatch(r.bus, bus));
}

export async function loadUserAssignedTransportBus(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("assigned_transport_bus")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Transport] Load assigned bus failed:", error.message);
    return null;
  }

  const raw = (data as { assigned_transport_bus?: string | null } | null)?.assigned_transport_bus;
  return raw?.trim() || null;
}
