/** On-roster if not explicitly inactive (null/empty status counts as active). */
export function isActiveRosterStatus(status: unknown): boolean {
  if (status == null) return true;
  const s = String(status).trim().toLowerCase();
  if (!s) return true;
  return s !== 'inactive';
}

export function filterActiveRoster<T extends { status?: string | null }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows || []).filter((row) => isActiveRosterStatus(row.status));
}

/** Enrolled camper — CampMinder sync sets status=active; matches Day Camp dashboard + birthday report. */
export function isEnrolledCamperStatus(status: unknown): boolean {
  return String(status ?? '').trim().toLowerCase() === 'active';
}

/** Hired staff for birthday widgets — active status with a real name. */
export function isHiredStaffForBirthday(row: { status?: unknown; name?: unknown }): boolean {
  const name = String(row.name ?? '').trim();
  if (!name || name.toLowerCase() === 'unknown') return false;
  return isEnrolledCamperStatus(row.status);
}

export function filterEnrolledCampers<T extends { status?: string | null }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows || []).filter((row) => isEnrolledCamperStatus(row.status));
}

export function filterHiredStaffForBirthday<T extends { status?: unknown; name?: unknown }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows || []).filter((row) => isHiredStaffForBirthday(row));
}
