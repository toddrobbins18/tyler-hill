/** North Shore / day camp parent requests — same-day cutoff in camp local time. */
export const PARENT_SAME_DAY_CUTOFF_HOUR = 13; // 1:00 PM
export const CAMP_TIMEZONE = "America/New_York";

export const SAME_DAY_CUTOFF_MESSAGE =
  "Same-day requests close at 1:00 PM. You may not submit this request online — please call camp to make this change.";

export function campTodayDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAMP_TIMEZONE }).format(now);
}

export function campLocalHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number(hour);
}

/** Block online submission when the request date is today and camp local time is 1pm or later. */
export function isSameDayRequestBlocked(requestDate: string, now = new Date()): boolean {
  if (!requestDate) return false;
  const today = campTodayDateString(now);
  if (requestDate !== today) return false;
  return campLocalHour(now) >= PARENT_SAME_DAY_CUTOFF_HOUR;
}
