/** Company slugs — keep in sync with `companies.slug` and mobile `constants/camps.ts`. */
export const CAMP_SLUG = {
  TIMBER_LAKE_CAMP: "timber-lake-camp",
  TIMBER_LAKE_WEST: "timber-lake-west",
  TYLER_HILL_CAMP: "tyler-hill-camp",
} as const;

export type CampSlug = (typeof CAMP_SLUG)[keyof typeof CAMP_SLUG];

export function isTimberLakeCamp(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.TIMBER_LAKE_CAMP;
}

export function isTimberLakeWest(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.TIMBER_LAKE_WEST;
}

export function isTylerHillCamp(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.TYLER_HILL_CAMP;
}

type CampLike = { slug?: string | null; name?: string | null } | null | undefined;

/** Timber Lake West — slug first, then company name fallback if slug was misconfigured. */
export function isTimberLakeWestCompany(company: CampLike): boolean {
  if (!company) return false;
  if (isTimberLakeWest(company.slug)) return true;
  return (company.name ?? "").toLowerCase().includes("timber lake west");
}

/** Tiger Times is Timber Lake Camp only — never Timber Lake West. */
export function shouldShowTigerTimes(company: CampLike): boolean {
  if (!company) return false;
  if (isTimberLakeWestCompany(company)) return false;
  return isTimberLakeCamp(company.slug);
}
