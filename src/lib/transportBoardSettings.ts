/** Global transport board settings (one camp-wide pickup-time knob). */
export type TransportBoardSettings = {
  /** Add N minutes at each passenger stop when estimating pickup times. */
  stopPickupMinutes: number;
  stopPickupEnabled: boolean;
};

export const DEFAULT_TRANSPORT_BOARD_SETTINGS: TransportBoardSettings = {
  stopPickupMinutes: 2,
  stopPickupEnabled: true,
};

export function normalizeTransportBoardSettings(
  raw: Partial<TransportBoardSettings> | null | undefined,
): TransportBoardSettings {
  const minutes = Number(raw?.stopPickupMinutes);
  return {
    stopPickupEnabled: raw?.stopPickupEnabled !== false,
    stopPickupMinutes: Number.isFinite(minutes) && minutes >= 0 && minutes <= 15
      ? Math.round(minutes)
      : DEFAULT_TRANSPORT_BOARD_SETTINGS.stopPickupMinutes,
  };
}

export function effectiveStopDwellMinutes(settings: TransportBoardSettings): number {
  return settings.stopPickupEnabled ? settings.stopPickupMinutes : 0;
}
