/**
 * Roster division filter helpers — Tyler Hill uses parallel division names
 * (e.g. "Teen Boys" vs "Teen TN1 Boys") that should filter together.
 */

export function normalizeDivisionNameForFilter(name?: string | null): string {
  if (!name) return "";

  return name
    .replace(/\bSuper\s+Senior\b/gi, "Super")
    .replace(/\bTN\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** User-facing division label (canonical names Todd expects). */
export function getDivisionDropdownLabel(name?: string | null): string {
  if (!name) return "";

  return name
    .replace(/\bSuper\s+Senior\b/gi, "Super")
    .replace(/\bTN\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function divisionsMatchForFilter(a?: string | null, b?: string | null): boolean {
  const left = normalizeDivisionNameForFilter(a);
  const right = normalizeDivisionNameForFilter(b);
  return !!left && left === right;
}

/** Include all division ids that share the same normalized roster bucket. */
export function expandDivisionIdsForRosterFilter(
  divisionIds: string[],
  divisions: { id: string; name?: string | null }[],
): string[] {
  if (divisionIds.length === 0 || divisions.length === 0) return divisionIds;

  const normalizedTargets = new Set<string>();
  for (const id of divisionIds) {
    const div = divisions.find((d) => d.id === id);
    const normalized = normalizeDivisionNameForFilter(div?.name);
    if (normalized) normalizedTargets.add(normalized);
  }

  const expanded = new Set(divisionIds);
  for (const div of divisions) {
    const normalized = normalizeDivisionNameForFilter(div.name);
    if (normalized && normalizedTargets.has(normalized)) {
      expanded.add(div.id);
    }
  }

  return [...expanded];
}

export function camperMatchesDivisionFilter(
  camperDivisionId: string | null | undefined,
  camperDivisionName: string | null | undefined,
  selectedDivisionId: string,
  selectedDivisionName?: string | null,
): boolean {
  if (selectedDivisionId === "all") return true;
  if (camperDivisionId && camperDivisionId === selectedDivisionId) return true;
  return divisionsMatchForFilter(camperDivisionName, selectedDivisionName);
}
