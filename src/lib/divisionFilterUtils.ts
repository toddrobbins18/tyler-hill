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

function stripDayCampGenderSuffix(value: string): string {
  return value.replace(/\s+(boys?|girls?)\s*$/i, "").trim();
}

/** Normalize division/grade labels to a shared day-camp grade bucket. */
export function normalizeDayCampGradeKey(value?: string | null): DayCampGradeSortKey | null {
  const raw = stripDayCampGenderSuffix((value ?? "").trim()).toLowerCase();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, " ").replace(/\s-\s/g, "-");
  const squashed = compact.replace(/\s/g, "");

  if (/^nursery(\s+campers?)?$/.test(compact)) return "nursery";
  if (squashed === "prek" || squashed === "pk") return "pre-k";
  if (/^pre\s*-?\s*k(inder(garten)?)?$/.test(compact)) return "pre-k";
  if (squashed === "kg" || squashed === "k") return "kindergarten";
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

/** North Shore program tiers: 1/2, 3/4, Crew (5–8), CIT (9). */
export const DAY_CAMP_PROGRAM_DIVISION_KEYS = [
  "nursery",
  "pre-k",
  "kindergarten",
  "half-12",
  "half-34",
  "crew",
  "cit",
] as const;

export type DayCampProgramDivisionKey = (typeof DAY_CAMP_PROGRAM_DIVISION_KEYS)[number];

const DAY_CAMP_PROGRAM_DIVISION_DISPLAY: Record<DayCampProgramDivisionKey, string> = {
  nursery: "Nursery",
  "pre-k": "Pre - K",
  kindergarten: "Kindergarten",
  "half-12": "1/2",
  "half-34": "3/4",
  crew: "Crew",
  cit: "CIT",
};

const DAY_CAMP_PROGRAM_DIVISION_SORT: Record<DayCampProgramDivisionKey, number> = {
  nursery: 0,
  "pre-k": 1,
  kindergarten: 2,
  "half-12": 3,
  "half-34": 4,
  crew: 5,
  cit: 6,
};

function compactDayCampLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map division/grade labels to Todd's program buckets (1/2, 3/4, Crew, CIT). */
export function resolveDayCampProgramDivisionKey(
  value?: string | null,
): DayCampProgramDivisionKey | null {
  const raw = compactDayCampLabel(stripDayCampGenderSuffix(value ?? ""));
  if (!raw) return null;

  if (/\bcit\b/.test(raw)) return "cit";
  if (/\bcrew\b/.test(raw)) return "crew";

  const squashed = raw.replace(/\s/g, "").replace(/-/g, "");
  if (squashed === "1/2" || squashed === "12") return "half-12";
  if (squashed === "3/4" || squashed === "34") return "half-34";

  const gradeKey = normalizeDayCampGradeKey(value);
  if (!gradeKey) return null;

  if (gradeKey === "nursery") return "nursery";
  if (gradeKey === "pre-k") return "pre-k";
  if (gradeKey === "kindergarten") return "kindergarten";
  if (gradeKey === "1st" || gradeKey === "2nd") return "half-12";
  if (gradeKey === "3rd" || gradeKey === "4th") return "half-34";
  if (
    gradeKey === "5th" ||
    gradeKey === "6th" ||
    gradeKey === "7th" ||
    gradeKey === "8th"
  ) {
    return "crew";
  }
  if (gradeKey === "9th") return "cit";

  return null;
}

export function getDayCampProgramDivisionSortIndex(value?: string | null): number {
  const key = resolveDayCampProgramDivisionKey(value);
  if (!key) return 9999;
  return DAY_CAMP_PROGRAM_DIVISION_SORT[key];
}

export function getDayCampProgramDivisionDisplay(value?: string | null): string {
  const key = resolveDayCampProgramDivisionKey(value);
  if (key) return DAY_CAMP_PROGRAM_DIVISION_DISPLAY[key];
  return (value ?? "").trim();
}

export function compareDayCampProgramDivisionsByName(
  nameA?: string | null,
  nameB?: string | null,
): number {
  const prog = getDayCampProgramDivisionSortIndex(nameA) - getDayCampProgramDivisionSortIndex(nameB);
  if (prog !== 0) return prog;
  const byGrade = getDayCampGradeSortIndex(nameA) - getDayCampGradeSortIndex(nameB);
  if (byGrade !== 0) return byGrade;
  return (nameA ?? "").localeCompare(nameB ?? "", undefined, { sensitivity: "base" });
}

/** Prefer Camp Grade on the child when division is a bunk/group label (Paris, etc.). */
export function resolveDayCampGradeSortLabel(
  divisionName?: string | null,
  grade?: string | null,
): string {
  const division = (divisionName ?? "").trim();
  const gradeVal = (grade ?? "").trim();
  if (normalizeDayCampGradeKey(division)) return division;
  if (normalizeDayCampGradeKey(gradeVal)) return gradeVal;
  return division || gradeVal;
}

export function compareDayCampGradesByLabels(
  divisionNameA?: string | null,
  gradeA?: string | null,
  divisionNameB?: string | null,
  gradeB?: string | null,
): number {
  const labelA = resolveDayCampGradeSortLabel(divisionNameA, gradeA);
  const labelB = resolveDayCampGradeSortLabel(divisionNameB, gradeB);
  const byProgram =
    getDayCampProgramDivisionSortIndex(labelA) - getDayCampProgramDivisionSortIndex(labelB);
  if (byProgram !== 0) return byProgram;
  const byGrade = getDayCampGradeSortIndex(labelA) - getDayCampGradeSortIndex(labelB);
  if (byGrade !== 0) return byGrade;
  return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
}

/** Nursery, Pre-K, and Kindergarten — coed bunking / youngest grades. */
export function isCoedYoungDayCampGrade(value?: string | null): boolean {
  const key = normalizeDayCampGradeKey(value);
  return key === "nursery" || key === "pre-k" || key === "kindergarten";
}

export function getCanonicalDayCampGradeDisplay(
  divisionName?: string | null,
  grade?: string | null,
): string {
  const label = resolveDayCampGradeSortLabel(divisionName, grade);
  const key = normalizeDayCampGradeKey(label);
  if (key) return DAY_CAMP_GRADE_DISPLAY[key];
  return label || "—";
}

/** CampMinder-facing label for day-camp grade divisions. */
export function getDayCampDivisionDropdownLabel(name?: string | null): string {
  const key = normalizeDayCampGradeKey(name);
  if (key) return DAY_CAMP_GRADE_DISPLAY[key];
  const program = resolveDayCampProgramDivisionKey(name);
  if (program) return DAY_CAMP_PROGRAM_DIVISION_DISPLAY[program];
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

/** Program-tier division dropdown (Nursery … 1/2, 3/4, Crew, CIT). */
export function prepareDayCampDivisionDropdown(
  divisions: DivisionOption[],
  campers: DayCampCamperDivisionSource[] = [],
): DivisionOption[] {
  const byKey = new Map<DayCampProgramDivisionKey, DivisionOption>();

  const consider = (rawName: string | null | undefined, division?: DivisionOption) => {
    if (!division?.id) return;
    const sortLabel = rawName ?? "";
    const programKey =
      resolveDayCampProgramDivisionKey(sortLabel) ??
      resolveDayCampProgramDivisionKey(division.name);
    if (!programKey) return;

    const displayName = DAY_CAMP_PROGRAM_DIVISION_DISPLAY[programKey];
    const candidate: DivisionOption = {
      ...division,
      name: displayName,
      sort_order: DAY_CAMP_PROGRAM_DIVISION_SORT[programKey],
    };

    const existing = byKey.get(programKey);
    if (!existing || (candidate.sort_order ?? 999) < (existing.sort_order ?? 999)) {
      byKey.set(programKey, candidate);
    }
  };

  for (const division of divisions) {
    consider(division.name, division);
  }

  for (const camper of campers) {
    const linked = divisions.find((d) => d.id === camper.division_id);
    const sortLabel = resolveDayCampGradeSortLabel(
      camper.division?.name ?? linked?.name,
      camper.grade,
    );
    consider(sortLabel, linked ?? camper.division ?? undefined);
    consider(camper.grade, linked ?? camper.division ?? undefined);
  }

  return [...byKey.values()].sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999),
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

  const selectedProgram = resolveDayCampProgramDivisionKey(selectedDivisionName);
  if (selectedProgram) {
    const camperProgram = resolveDayCampProgramDivisionKey(
      resolveDayCampGradeSortLabel(camperDivisionName, camperGrade),
    );
    if (camperProgram && camperProgram === selectedProgram) return true;
  }

  const selectedKey = normalizeDayCampGradeKey(selectedDivisionName);
  if (selectedKey) {
    const camperKey = normalizeDayCampGradeKey(
      resolveDayCampGradeSortLabel(camperDivisionName, camperGrade),
    );
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
