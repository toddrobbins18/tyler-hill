/** Enrolled camper — CampMinder sync sets status=active. */
export function isEnrolledCamperStatus(status: unknown): boolean {
  return String(status ?? "").trim().toLowerCase() === "active";
}

/** Hired staff for birthday lists — active status with a real name. */
export function isHiredStaffForBirthday(row: { status?: unknown; name?: unknown }): boolean {
  const name = String(row.name ?? "").trim();
  if (!name || name.toLowerCase() === "unknown") return false;
  return isEnrolledCamperStatus(row.status);
}
