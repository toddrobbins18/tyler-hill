/** Camps fully closed — no automated outbound email (including daily bulletin). */
export const ALL_EMAILS_STOPPED_CAMP_SLUGS = new Set([
  "tyler-hill-camp",
  "timber-lake-camp",
  "timber-lake-west",
]);

/** No automated in-app bell notifications (Messages / notification dropdown). */
export const IN_APP_AUTOMATED_NOTIFICATIONS_STOPPED_CAMP_SLUGS = new Set([
  "tyler-hill-camp",
  "timber-lake-camp",
  "timber-lake-west",
]);

export function isAllEmailsStoppedCamp(slug: string | null | undefined): boolean {
  return !!slug && ALL_EMAILS_STOPPED_CAMP_SLUGS.has(slug);
}

export function isInAppAutomatedNotificationsStoppedCamp(slug: string | null | undefined): boolean {
  return !!slug && IN_APP_AUTOMATED_NOTIFICATIONS_STOPPED_CAMP_SLUGS.has(slug);
}
