/**
 * Calendar birthday matching (avoid `new Date("YYYY-MM-DD")` TZ shifts).
 * Aligned with Camp-Database-mobile-app `birthdayDate.ts`.
 */
export function parseBirthdayCalendarParts(value: unknown): { year: number; month: number; day: number } | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { year, month, day };
    }
  }

  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    const month = parseInt(us[1], 10);
    const day = parseInt(us[2], 10);
    const year = parseInt(us[3], 10);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return { year, month, day };
    }
  }

  return null;
}

export function isBirthdayTodayCalendar(dateValue: unknown, todayMonth: number, todayDay: number): boolean {
  const p = parseBirthdayCalendarParts(dateValue);
  return p != null && p.month === todayMonth && p.day === todayDay;
}

/** Match Staff list / roster: exclude only explicit inactive (null or empty counts as active). */
export function isActiveRosterStatus(status: unknown): boolean {
  if (status == null) return true;
  const s = String(status).trim().toLowerCase();
  if (!s) return true;
  return s !== 'inactive';
}

/** Normalize CampMinder / form values to Postgres `date` (YYYY-MM-DD). */
export function toBirthdayIsoDate(value: unknown): string | null {
  const p = parseBirthdayCalendarParts(value);
  if (!p) return null;
  const m = String(p.month).padStart(2, '0');
  const d = String(p.day).padStart(2, '0');
  return `${p.year}-${m}-${d}`;
}
