/** Company slugs — keep in sync with `companies.slug` and mobile `constants/camps.ts`. */
export const CAMP_SLUG = {
  TIMBER_LAKE_CAMP: "timber-lake-camp",
  TIMBER_LAKE_WEST: "timber-lake-west",
  TYLER_HILL_CAMP: "tyler-hill-camp",
  NORTH_SHORE_DAY_CAMP: "north-shore-day-camp",
} as const;

export type CampSlug = (typeof CAMP_SLUG)[keyof typeof CAMP_SLUG];

export type CampType = "overnight" | "day_camp";

export function isTimberLakeCamp(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.TIMBER_LAKE_CAMP;
}

export function isTimberLakeWest(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.TIMBER_LAKE_WEST;
}

export function isTylerHillCamp(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.TYLER_HILL_CAMP;
}

export type CampLike =
  | { slug?: string | null; name?: string | null; camp_type?: CampType | string | null }
  | null
  | undefined;

export function isNorthShoreDayCamp(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.NORTH_SHORE_DAY_CAMP;
}

/** North Shore bus-route map transport — not used by Tyler Hill, Timber Lake, or other overnight camps. */
export function northShoreBusTransportEnabled(company: CampLike): boolean {
  return isNorthShoreDayCamp(company?.slug);
}

/** Day camps use CampHub-style UI (North Shore first; Hampton/Southampton later). */
export function isDayCampCompany(company: CampLike): boolean {
  if (!company) return false;
  if (company.camp_type === "day_camp") return true;
  return isNorthShoreDayCamp(company.slug);
}

export function isOvernightCampCompany(company: CampLike): boolean {
  return !isDayCampCompany(company);
}

const APPOINTMENTS_ENABLED_OVERNIGHT_SLUGS = [
  CAMP_SLUG.TYLER_HILL_CAMP,
  CAMP_SLUG.TIMBER_LAKE_CAMP,
  CAMP_SLUG.TIMBER_LAKE_WEST,
  "trails-end-camp",
] as const;

/** Appointments module — overnight slugs + all day camps (North Shore, etc.). */
export function appointmentsEnabledForCompany(company: CampLike): boolean {
  if (!company) return false;
  if (isDayCampCompany(company)) return true;
  const slug = company.slug ?? "";
  return APPOINTMENTS_ENABLED_OVERNIGHT_SLUGS.includes(slug as (typeof APPOINTMENTS_ENABLED_OVERNIGHT_SLUGS)[number]);
}

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

/** Daily news page title — uses company name for day camps and future camps. */
export function getDailyNewsCampLabel(company: CampLike): string {
  if (isTylerHillCamp(company?.slug)) return "Tyler Hill";
  if (isTimberLakeWestCompany(company)) return "Timber Lake West";
  if (isTimberLakeCamp(company?.slug)) return "Timber Lake Camp";
  return (company?.name ?? "The Nest").trim();
}

export function getDailyNewsPageTitle(company: CampLike): string {
  if (isTimberLakeWestCompany(company)) return "Daily Wolf";
  return `${getDailyNewsCampLabel(company)} Daily News`;
}

export function getDailyNewsPrintHeadline(company: CampLike): string {
  if (isTimberLakeWestCompany(company)) return "THE DAILY WOLF";
  return `${getDailyNewsCampLabel(company).toUpperCase()} DAILY NEWS`;
}

export function getDailyNewsSubtitle(company: CampLike): string {
  if (isTylerHillCamp(company?.slug)) return "HOME OF THE BEARS";
  if (isTimberLakeWestCompany(company)) return "TIMBER LAKE WEST";
  return "";
}
