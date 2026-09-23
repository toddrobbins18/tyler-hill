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

/** CampMinder day-camp grade order (North Shore). */
export const DAY_CAMP_GRADE_SORT_KEYS = [
  "nursery",
  "pre-k",
  "kindergarten",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
] as const;

export type DayCampGradeSortKey = (typeof DAY_CAMP_GRADE_SORT_KEYS)[number];

const DAY_CAMP_GRADE_DISPLAY: Record<DayCampGradeSortKey, string> = {
  nursery: "Nursery",
  "pre-k": "Pre - K",
  kindergarten: "Kindergarten",
  "1st": "1st",
  "2nd": "2nd",
  "3rd": "3rd",
  "4th": "4th",
  "5th": "5th",
  "6th": "6th",
  "7th": "7th",
  "8th": "8th",
  "9th": "9th",
};

const ORDINAL_SUFFIX: Record<number, string> = {
  1: "st",
  2: "nd",
  3: "rd",
};

function ordinalGradeKey(n: number): DayCampGradeSortKey | null {
  if (n < 1 || n > 9) return null;
  const suffix = ORDINAL_SUFFIX[n] ?? "th";
  const key = `${n}${suffix}` as DayCampGradeSortKey;
  return DAY_CAMP_GRADE_SORT_KEYS.includes(key) ? key : null;
}

/** Normalize division/grade labels to a shared day-camp grade bucket. */
export function normalizeDayCampGradeKey(value?: string | null): DayCampGradeSortKey | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, " ").replace(/\s-\s/g, "-");

  if (/^nursery(\s+campers?)?$/.test(compact)) return "nursery";
  if (/^pre\s*-?\s*k(inder(garten)?)?$/.test(compact)) return "pre-k";
  if (/^k(inder(garten)?)?$/.test(compact)) return "kindergarten";

  const ordinalMatch = compact.match(/^(\d+)(st|nd|rd|th)?$/);
  if (ordinalMatch) {
    return ordinalGradeKey(Number(ordinalMatch[1]));
  }

  const gradeWordMatch = compact.match(/^grade\s*(\d+)/);
  if (gradeWordMatch) {
    return ordinalGradeKey(Number(gradeWordMatch[1]));
  }

  return null;
}

export function getDayCampGradeSortIndex(value?: string | null): number {
  const key = normalizeDayCampGradeKey(value);
  if (!key) return 9999;
  const idx = DAY_CAMP_GRADE_SORT_KEYS.indexOf(key);
  return idx >= 0 ? idx : 9999;
}

/** CampMinder-facing label for day-camp grade divisions. */
export function getDayCampDivisionDropdownLabel(name?: string | null): string {
  const key = normalizeDayCampGradeKey(name);
  if (key) return DAY_CAMP_GRADE_DISPLAY[key];
  return getDivisionDropdownLabel(name);
}

export function isDayCampGradeDivision(value?: string | null): boolean {
  return normalizeDayCampGradeKey(value) != null;
}

type DayCampCamperDivisionSource = {
  division_id?: string | null;
  grade?: string | null;
  division?: { id?: string; name?: string | null; sort_order?: number | null } | null;
};

/** Grade-ordered division dropdown — hides legacy CM program divisions (e.g. Voyager Girls). */
export function prepareDayCampDivisionDropdown(
  divisions: DivisionOption[],
  campers: DayCampCamperDivisionSource[] = [],
): DivisionOption[] {
  const byKey = new Map<DayCampGradeSortKey, DivisionOption>();

  const consider = (rawName: string | null | undefined, division?: DivisionOption) => {
    const key = normalizeDayCampGradeKey(rawName);
    if (!key || !division?.id) return;

    const displayName = DAY_CAMP_GRADE_DISPLAY[key];
    const candidate: DivisionOption = {
      ...division,
      name: displayName,
      sort_order: getDayCampGradeSortIndex(displayName),
    };

    const existing = byKey.get(key);
    if (!existing || (candidate.sort_order ?? 999) < (existing.sort_order ?? 999)) {
      byKey.set(key, candidate);
    }
  };

  for (const division of divisions) {
    consider(division.name, division);
  }

  for (const camper of campers) {
    const linked = divisions.find((d) => d.id === camper.division_id);
    consider(camper.division?.name ?? linked?.name, linked ?? camper.division ?? undefined);
    consider(camper.grade, linked ?? camper.division ?? undefined);
  }

  return [...byKey.values()].sort(
    (a, b) => getDayCampGradeSortIndex(a.name) - getDayCampGradeSortIndex(b.name),
  );
}

export function camperMatchesDayCampDivisionFilter(
  camperDivisionId: string | null | undefined,
  camperDivisionName: string | null | undefined,
  camperGrade: string | null | undefined,
  selectedDivisionId: string,
  selectedDivisionName?: string | null,
): boolean {
  if (selectedDivisionId === "all") return true;
  if (camperDivisionId && camperDivisionId === selectedDivisionId) return true;

  const selectedKey = normalizeDayCampGradeKey(selectedDivisionName);
  if (selectedKey) {
    const camperKey =
      normalizeDayCampGradeKey(camperDivisionName) ?? normalizeDayCampGradeKey(camperGrade);
    if (camperKey && camperKey === selectedKey) return true;
  }

  return camperMatchesDivisionFilter(
    camperDivisionId,
    camperDivisionName,
    selectedDivisionId,
    selectedDivisionName,
  );
}

export type CamperGenderFilter = "all" | "Male" | "Female";

export function normalizeCamperGender(gender?: string | null): "Male" | "Female" | null {
  const value = (gender ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "male" || value === "boy" || value === "boys" || value === "m") return "Male";
  if (value === "female" || value === "girl" || value === "girls" || value === "f") return "Female";
  return null;
}

export function camperMatchesGenderFilter(
  gender: string | null | undefined,
  selectedGender: CamperGenderFilter,
): boolean {
  if (selectedGender === "all") return true;
  return normalizeCamperGender(gender) === selectedGender;
}

export function compareByCamperGender(
  genderA: string | null | undefined,
  genderB: string | null | undefined,
): number {
  const order = (gender: string | null | undefined) => {
    const normalized = normalizeCamperGender(gender);
    if (normalized === "Male") return 0;
    if (normalized === "Female") return 1;
    return 2;
  };
  return order(genderA) - order(genderB);
}

/** K, Pre-K, Nursery, 1st, 2nd, etc. — day-camp divisions are often the same camp grade. */
export function looksLikeCampGrade(value?: string | null): boolean {
  return isDayCampGradeDivision(value);
}

/** School/camp grade for display — never repeat the division name in the grade slot. */
export function getCamperGradeDisplay(
  grade?: string | null,
  divisionName?: string | null,
): string {
  const value = (grade ?? "").trim();
  if (!value) return "N/A";
  // Day camp: grade and division both come from CampGradeID — show CampMinder label.
  if (looksLikeCampGrade(value)) return getDayCampDivisionDropdownLabel(value);
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
