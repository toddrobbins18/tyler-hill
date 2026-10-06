/** Global transport board settings (one camp-wide pickup-time knob). */
export type TransportBoardSettings = {
  /** Add N minutes at each passenger stop when estimating pickup times. */
  stopPickupMinutes: number;
  stopPickupEnabled: boolean;
  /** Per-route normalized address keys — pinned pickups stay put when optimizing. */
  pinnedStopsByRoute?: Record<number, string[]>;
};

export const DEFAULT_TRANSPORT_BOARD_SETTINGS: TransportBoardSettings = {
  stopPickupMinutes: 2,
  stopPickupEnabled: true,
};

export function normalizeTransportBoardSettings(
  raw: Partial<TransportBoardSettings> | null | undefined,
): TransportBoardSettings {
  const minutes = Number(raw?.stopPickupMinutes);
  let pinnedStopsByRoute: Record<number, string[]> | undefined;
  const pinnedRaw = raw?.pinnedStopsByRoute;
  if (pinnedRaw && typeof pinnedRaw === "object" && !Array.isArray(pinnedRaw)) {
    pinnedStopsByRoute = {};
    for (const [routeKey, values] of Object.entries(pinnedRaw)) {
      if (!Array.isArray(values)) continue;
      const keys = values.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      if (keys.length > 0) pinnedStopsByRoute[Number(routeKey)] = keys;
    }
    if (Object.keys(pinnedStopsByRoute).length === 0) pinnedStopsByRoute = undefined;
  }

  return {
    stopPickupEnabled: raw?.stopPickupEnabled !== false,
    stopPickupMinutes: Number.isFinite(minutes) && minutes >= 0 && minutes <= 15
      ? Math.round(minutes)
      : DEFAULT_TRANSPORT_BOARD_SETTINGS.stopPickupMinutes,
    pinnedStopsByRoute,
  };
}

export function effectiveStopDwellMinutes(settings: TransportBoardSettings): number {
  return settings.stopPickupEnabled ? settings.stopPickupMinutes : 0;
}
