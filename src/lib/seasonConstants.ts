/** Supported camp seasons in The Nest (web). */
export const AVAILABLE_SEASONS = ["2025", "2026", "2027"] as const;

export type CampSeason = (typeof AVAILABLE_SEASONS)[number];

/** Default working season after 2026→2027 rollover. */
export const DEFAULT_SEASON: CampSeason = "2027";

/** Bump to reset users to DEFAULT_SEASON once (localStorage bootstrap). */
export const SEASON_BOOTSTRAP_VERSION = "2027-default-v1";

export function isCampSeason(value: string | null | undefined): value is CampSeason {
  return !!value && (AVAILABLE_SEASONS as readonly string[]).includes(value);
}
