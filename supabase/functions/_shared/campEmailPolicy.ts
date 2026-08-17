/** Camps paused — daily bulletin only (birthdays + schedule). All other automated email off. */
export const DAILY_BULLETIN_ONLY_CAMP_SLUGS = new Set([
  "tyler-hill-camp",
]);

/** Camps fully closed — no automated email at all (including daily bulletin). */
export const ALL_EMAILS_STOPPED_CAMP_SLUGS = new Set([
  "timber-lake-camp",
  "timber-lake-west",
]);

export function isDailyBulletinOnlyCamp(slug: string | null | undefined): boolean {
  return !!slug && DAILY_BULLETIN_ONLY_CAMP_SLUGS.has(slug);
}

export function isAllEmailsStoppedCamp(slug: string | null | undefined): boolean {
  return !!slug && ALL_EMAILS_STOPPED_CAMP_SLUGS.has(slug);
}
