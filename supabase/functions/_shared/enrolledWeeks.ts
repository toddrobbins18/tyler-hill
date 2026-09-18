/** Shared with sync-campminder — keep in sync with src/lib/enrolledWeeks.ts */
export const DAY_CAMP_ENROLLMENT_WEEKS = 8;

const FULL_ENROLLMENT_PATTERN =
  /^(full|full\s*summer|full\s*season|all\s*weeks?|8\s*weeks?)$/i;

function addWeek(weeks: Set<number>, n: number) {
  if (n >= 1 && n <= DAY_CAMP_ENROLLMENT_WEEKS) weeks.add(n);
}

function addAllWeeks(weeks: Set<number>) {
  for (let w = 1; w <= DAY_CAMP_ENROLLMENT_WEEKS; w++) weeks.add(w);
}

export function isFullEnrollmentLabel(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return false;
  if (FULL_ENROLLMENT_PATTERN.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  return lower.startsWith("full ") && !/\bweek\s*\d/i.test(trimmed);
}

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
