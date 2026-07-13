/** Extract last name from a full name (uses final word). */
export function getLastName(name?: string | null): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] || trimmed;
}

/** Sort people by last name, then full name for ties. */
export function compareByLastName(
  a: { name?: string | null },
  b: { name?: string | null },
): number {
  const lastCmp = getLastName(a.name).localeCompare(getLastName(b.name), undefined, {
    sensitivity: "base",
  });
  if (lastCmp !== 0) return lastCmp;
  return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" });
}
