/** North Shore Sunshine Report — only these FULLSUMMERGROUP values belong on Sunshine. */
export const NORTH_SHORE_SUNSHINE_GROUP_NAMES = [
  "Ducklings",
  "Bunnies",
  "Pandas",
  "Giraffes",
  "Koalas",
] as const;

export type NorthShoreSunshineGroupName = (typeof NORTH_SHORE_SUNSHINE_GROUP_NAMES)[number];

const SORT_ORDER: Record<NorthShoreSunshineGroupName, number> = {
  Ducklings: 0,
  Bunnies: 1,
  Pandas: 2,
  Giraffes: 3,
  Koalas: 4,
};

export function isNorthShoreSunshineGroup(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const normalized = name.trim().toLowerCase();
  return NORTH_SHORE_SUNSHINE_GROUP_NAMES.some((g) => g.toLowerCase() === normalized);
}

/** Canonical display name (e.g. "bunnies" → "Bunnies") or null if not a Sunshine group. */
export function canonicalSunshineGroupName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  return (
    NORTH_SHORE_SUNSHINE_GROUP_NAMES.find((g) => g.toLowerCase() === normalized) ?? null
  );
}

export function sunshineGroupSortOrder(name: string): number {
  const canonical = canonicalSunshineGroupName(name);
  if (!canonical) return 999;
  return SORT_ORDER[canonical as NorthShoreSunshineGroupName];
}
