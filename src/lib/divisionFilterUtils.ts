/**
 * Roster division filter helpers — Tyler Hill uses parallel division names
 * (e.g. "Teen Boys" vs "Teen TN1 Boys") that should filter together.
 */

export function normalizeDivisionNameForFilter(name?: string | null): string {
  if (!name) return "";

  return name
    .replace(/\bSuper\s+Senior\b/gi, "Super")
    .replace(/\bSub\s+Senior\b/gi, "Super")
    .replace(/\bTeens\b/gi, "Teen")
    .replace(/\bTN\d+\b/gi, "Teen")
    .replace(/\bTeen\s+Teen\b/gi, "Teen")
    .replace(/\s+[A-Z0-9]\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** User-facing division label (canonical names Todd expects). */
export function getDivisionDropdownLabel(name?: string | null): string {
  if (!name) return "";

  return name
    .replace(/\bSuper\s+Senior\b/gi, "Super")
    .replace(/\bSub\s+Senior\b/gi, "Super")
    .replace(/\bTeens\b/gi, "Teen")
    .replace(/\bTN\d+\b/gi, "Teen")
    .replace(/\bTeen\s+Teen\b/gi, "Teen")
    .replace(/\s+/g, " ")
    .trim();
}

export type DivisionOption = {
  id: string;
  name?: string | null;
  sort_order?: number | null;
};

/** One dropdown row per canonical division label (drops TN alias duplicates). */
export function dedupeDivisionsForDropdown(divisions: DivisionOption[]): DivisionOption[] {
  const byKey = new Map<string, DivisionOption>();

  for (const division of divisions) {
    const label = getDivisionDropdownLabel(division.name);
    if (!label) continue;
    const key = normalizeDivisionNameForFilter(label);
    const existing = byKey.get(key);
    if (!existing || (division.sort_order ?? 999) < (existing.sort_order ?? 999)) {
      byKey.set(key, division);
    }
  }

  return [...byKey.values()].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999),
  );
}

/** K, Pre-K, 1st, 2nd, etc. — day-camp divisions are often the same camp grade. */
export function looksLikeCampGrade(value?: string | null): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return false;
  if (/^pre-?k(inder(garten)?)?$/.test(v)) return true;
  if (/^k(inder(garten)?)?$/.test(v)) return true;
  if (/^\d+(st|nd|rd|th)?$/.test(v)) return true;
  if (/^grade\s*\d+/.test(v)) return true;
  return false;
}

/** School/camp grade for display — never repeat the division name in the grade slot. */
export function getCamperGradeDisplay(
  grade?: string | null,
  divisionName?: string | null,
): string {
  const value = (grade ?? "").trim();
  if (!value) return "N/A";
  // Day camp: grade and division both come from CampGradeID (e.g. "2nd") — keep grade visible.
  if (looksLikeCampGrade(value)) return value;
  if (divisionsMatchForFilter(value, divisionName)) return "N/A";
  if (divisionsMatchForFilter(value, getDivisionDropdownLabel(divisionName))) return "N/A";
  return value;
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

/** Resolve permission division ids to active roster buckets (handles inactive alias rows). */
export function resolvePermissionDivisionIds(
  permissionDivisionIds: string[],
  divisions: { id: string; name?: string | null; is_active?: boolean | null }[],
): string[] {
  if (permissionDivisionIds.length === 0) return permissionDivisionIds;

  const activeDivisions = divisions.filter((d) => d.is_active !== false);
  const seedNames = new Set<string>();

  for (const id of permissionDivisionIds) {
    const div = divisions.find((d) => d.id === id);
    const normalized = normalizeDivisionNameForFilter(div?.name);
    if (normalized) seedNames.add(normalized);
  }

  const resolved = activeDivisions
    .filter((d) => seedNames.has(normalizeDivisionNameForFilter(d.name)))
    .map((d) => d.id);

  return expandDivisionIdsForRosterFilter(
    resolved.length > 0 ? resolved : permissionDivisionIds,
    activeDivisions,
  );
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

type CamperDivisionSource = {
  division_id?: string | null;
  division?: { id?: string; name?: string | null; sort_order?: number | null } | null;
  bunk?: {
    division_id?: string | null;
    divisions?:
      | { id?: string; name?: string | null; sort_order?: number | null }
      | { id?: string; name?: string | null; sort_order?: number | null }[]
      | null;
  } | null;
};

/** Prefer child division; fall back to bunk division when division_id is unset. */
export function getCamperEffectiveDivision(camper: CamperDivisionSource): {
  id: string | null;
  name: string | null;
  sort_order: number | null;
} {
  if (camper.division_id || camper.division?.id) {
    return {
      id: camper.division_id ?? camper.division?.id ?? null,
      name: camper.division?.name ?? null,
      sort_order: camper.division?.sort_order ?? null,
    };
  }

  const bunkDivisionRaw = camper.bunk?.divisions;
  const bunkDivision = Array.isArray(bunkDivisionRaw) ? bunkDivisionRaw[0] : bunkDivisionRaw;
  if (bunkDivision?.id || bunkDivision?.name || camper.bunk?.division_id) {
    return {
      id: bunkDivision?.id ?? camper.bunk?.division_id ?? null,
      name: bunkDivision?.name ?? null,
      sort_order: bunkDivision?.sort_order ?? null,
    };
  }

  return { id: null, name: null, sort_order: null };
}
