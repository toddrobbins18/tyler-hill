import type { TransportRouteStop } from "@/lib/transportRoster";

/** Map / list badge for a bus counselor pickup (camp uses "C"). */
export const BUS_COUNSELOR_STOP_LABEL = "S";

export type BusCounselorPickup = {
  staffId?: string | null;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export function isCounselorPickupStop(
  stop: { stopRole?: string | null } | null | undefined,
): boolean {
  return stop?.stopRole === "counselor";
}

export function isValidBusCounselorPickup(
  pickup: BusCounselorPickup | null | undefined,
): pickup is BusCounselorPickup {
  if (!pickup) return false;
  const name = pickup.name?.trim() ?? "";
  const address = pickup.address?.trim() ?? "";
  if (!name || !address) return false;
  if (!Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng)) return false;
  if (Math.abs(pickup.lat) < 0.0001 && Math.abs(pickup.lng) < 0.0001) return false;
  if (Math.abs(pickup.lat) > 90 || Math.abs(pickup.lng) > 180) return false;
  return true;
}

export function parseBusCounselorPickup(raw: unknown): BusCounselorPickup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pickup: BusCounselorPickup = {
    staffId: typeof o.staffId === "string" && o.staffId.trim() ? o.staffId.trim() : null,
    name: typeof o.name === "string" ? o.name.trim() : "",
    address: typeof o.address === "string" ? o.address.trim() : "",
    lat: typeof o.lat === "number" ? o.lat : Number(o.lat),
    lng: typeof o.lng === "number" ? o.lng : Number(o.lng),
  };
  return isValidBusCounselorPickup(pickup) ? pickup : null;
}

export function counselorPickupToStop(pickup: BusCounselorPickup): TransportRouteStop {
  const name = pickup.name.trim() || "Bus counselor";
  return {
    name,
    address: pickup.address.trim(),
    lat: pickup.lat,
    lng: pickup.lng,
    pickupTime: "",
    passengers: 0,
    camperNames: [],
    stopRole: "counselor",
  };
}

/** AM: counselor then kids. PM: kids then counselor. Camp is added by buildAMStops / buildPMStops. */
export function withCounselorPickupStops(
  camperStops: TransportRouteStop[],
  pickup: BusCounselorPickup | null | undefined,
  period: "am" | "pm",
): TransportRouteStop[] {
  if (!isValidBusCounselorPickup(pickup)) return camperStops;
  const stop = counselorPickupToStop(pickup);
  return period === "am" ? [stop, ...camperStops] : [...camperStops, stop];
}

/** Map a displayed stop index (camp + counselor + kids) onto camper coreStops. Null for camp / counselor. */
export function coreIndexFromDisplayStops(
  stops: { address: string; stopRole?: string | null }[],
  displayIdx: number,
  campAddress: string,
): number | null {
  const stop = stops[displayIdx];
  if (!stop) return null;
  if (isCounselorPickupStop(stop)) return null;
  if (stop.address === campAddress) return null;
  let core = 0;
  for (let i = 0; i < displayIdx; i++) {
    const s = stops[i];
    if (!s) continue;
    if (isCounselorPickupStop(s)) continue;
    if (s.address === campAddress) continue;
    core += 1;
  }
  return core;
}

export function counselorNameFromPickup(
  pickup: BusCounselorPickup | null | undefined,
): string | null {
  const name = pickup?.name?.trim();
  return name || null;
}
