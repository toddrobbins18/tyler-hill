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
