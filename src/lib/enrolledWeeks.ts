/** North Shore day camp runs 8 enrollment weeks; FULL = all weeks. */
export const DAY_CAMP_ENROLLMENT_WEEKS = 8;

const FULL_ENROLLMENT_PATTERN =
  /^(full|full\s*summer|full\s*season|all\s*weeks?|8\s*weeks?)$/i;

function addWeek(weeks: Set<number>, n: number) {
  if (n >= 1 && n <= DAY_CAMP_ENROLLMENT_WEEKS) weeks.add(n);
}

function addAllWeeks(weeks: Set<number>) {
  for (let w = 1; w <= DAY_CAMP_ENROLLMENT_WEEKS; w++) weeks.add(w);
}

/** True when a CampMinder session label means full summer (weeks 1–8). */
export function isFullEnrollmentLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (FULL_ENROLLMENT_PATTERN.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return lower.startsWith("full ") && !/\bweek\s*\d/i.test(trimmed);
}

/**
 * Parse CampMinder session string (comma-separated labels) into week numbers 1–8.
 * FULL / Full Summer → [1,2,3,4,5,6,7,8].
 */
export function parseEnrolledWeeksFromSession(session: string | null | undefined): number[] {
  if (!session?.trim()) return [];

  const weeks = new Set<number>();
  for (const part of session.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (isFullEnrollmentLabel(part)) {
      addAllWeeks(weeks);
      continue;
    }

    const weekMatch = part.match(/\bweek\s*[#]?\s*(\d+)\b/i);
    if (weekMatch) {
      addWeek(weeks, parseInt(weekMatch[1], 10));
      continue;
    }

    const shortWeek = part.match(/^w\s*(\d+)$/i);
    if (shortWeek) {
      addWeek(weeks, parseInt(shortWeek[1], 10));
      continue;
    }

    if (/^\d+$/.test(part)) {
      addWeek(weeks, parseInt(part, 10));
    }
  }

  return Array.from(weeks).sort((a, b) => a - b);
}

export function resolveEnrolledWeeks(
  enrolledWeeks: number[] | null | undefined,
  session: string | null | undefined,
): number[] {
  if (Array.isArray(enrolledWeeks) && enrolledWeeks.length > 0) {
    return [...enrolledWeeks].sort((a, b) => a - b);
  }
  return parseEnrolledWeeksFromSession(session);
}

export function isFullEnrollment(weeks: number[]): boolean {
  if (weeks.length !== DAY_CAMP_ENROLLMENT_WEEKS) return false;
  return weeks.every((w, i) => w === i + 1);
}

/** Display label for profile / dashboard. */
export function formatEnrolledWeeksLabel(weeks: number[]): string {
  if (!weeks.length) return "";
  if (isFullEnrollment(weeks)) return "Full (Weeks 1–8)";
  return weeks.map((w) => `Week ${w}`).join(", ");
}
