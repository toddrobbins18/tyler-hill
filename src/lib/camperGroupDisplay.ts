/** Day camp uses "Group" (Paris, Dolphins); overnight camps use "Bunk". */
export function camperAssignmentLabel(isDayCamp: boolean): "Group" | "Bunk" {
  return isDayCamp ? "Group" : "Bunk";
}

/** PostgREST may return a nested FK as an object or a one-element array. */
export function relationRecord<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function relationName(
  value: { name?: string | null } | { name?: string | null }[] | null | undefined,
): string {
  return relationRecord(value)?.name?.trim() || "";
}

type BunkRef = { bunk_name?: string | null; bunk_number?: number | null };

type CamperWithGroup = {
  group_name?: string | null;
  grade?: string | null;
  bunk?: BunkRef | BunkRef[] | null;
};

/** Prefer group_name, then bunk name, then numbered fallback. */
export function camperAssignmentDisplay(
  child: CamperWithGroup,
  isDayCamp: boolean,
): string | null {
  const fromGroup = child.group_name?.trim();
  if (fromGroup) return fromGroup;
  const bunk = relationRecord(child.bunk);
  const fromBunkName = bunk?.bunk_name?.trim();
  if (fromBunkName) return fromBunkName;
  if (bunk?.bunk_number != null) {
    const label = camperAssignmentLabel(isDayCamp);
    return `${label} ${bunk.bunk_number}`;
  }
  return null;
}

export function camperHasAssignment(child: CamperWithGroup): boolean {
  return camperAssignmentDisplay(child, true) != null || camperAssignmentDisplay(child, false) != null;
}

export type HealthVisitCamper = CamperWithGroup & {
  division?: { name?: string | null } | { name?: string | null }[] | null;
  leader?: { name?: string | null } | { name?: string | null }[] | null;
};

/** Group/bunk for health center visit log — roster group, bunk, division, then grade. */
export function healthVisitGroupForCamper(
  camper: HealthVisitCamper,
  isDayCamp: boolean,
): string {
  return (
    camperAssignmentDisplay(camper, isDayCamp)?.trim() ||
    relationName(camper.division) ||
    camper.grade?.trim() ||
    ""
  );
}

export function healthVisitCounselorForCamper(camper: HealthVisitCamper): string {
  return relationName(camper.leader);
}
