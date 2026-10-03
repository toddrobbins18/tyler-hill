/** Day camp uses "Group" (Paris, Dolphins); overnight camps use "Bunk". */
export function camperAssignmentLabel(isDayCamp: boolean): "Group" | "Bunk" {
  return isDayCamp ? "Group" : "Bunk";
}

type CamperWithGroup = {
  group_name?: string | null;
  bunk?: { bunk_name?: string | null; bunk_number?: number | null } | null;
};

/** Prefer group_name, then bunk name, then numbered fallback. */
export function camperAssignmentDisplay(
  child: CamperWithGroup,
  isDayCamp: boolean,
): string | null {
  const fromGroup = child.group_name?.trim();
  if (fromGroup) return fromGroup;
  const fromBunkName = child.bunk?.bunk_name?.trim();
  if (fromBunkName) return fromBunkName;
  if (child.bunk?.bunk_number != null) {
    const label = camperAssignmentLabel(isDayCamp);
    return `${label} ${child.bunk.bunk_number}`;
  }
  return null;
}

export function camperHasAssignment(child: CamperWithGroup): boolean {
  return camperAssignmentDisplay(child, true) != null || camperAssignmentDisplay(child, false) != null;
}

type HealthVisitCamper = CamperWithGroup & {
  division?: { name?: string | null } | null;
};

/** Group/bunk for health center visit log — roster group first, then division. */
export function healthVisitGroupForCamper(
  camper: HealthVisitCamper,
  isDayCamp: boolean,
): string {
  return (
    camperAssignmentDisplay(camper, isDayCamp)?.trim() ||
    camper.division?.name?.trim() ||
    ""
  );
}
