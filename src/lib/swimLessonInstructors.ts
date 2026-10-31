import type { SupabaseClient } from "@supabase/supabase-js";

const storageKey = (companyId: string) => `swim-lesson-instructors:${companyId}`;

/** Swim lesson instructors = lifeguards only (role, department, or Waterfront specialty). */
export function isSwimLessonLifeguardStaff(row: {
  role?: string | null;
  department?: string | null;
  specialty_sports?: string[] | null;
}): boolean {
  const role = (row.role ?? "").toLowerCase();
  if (role.includes("lifeguard")) return true;

  const department = (row.department ?? "").toLowerCase();
  if (department.includes("lifeguard") || department.includes("waterfront")) return true;

  for (const sport of row.specialty_sports ?? []) {
    const s = sport.toLowerCase();
    if (s.includes("waterfront") || s.includes("lifeguard")) return true;
  }

  return false;
}

export function loadSavedInstructorNames(companyId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  } catch {
    return [];
  }
}

export function saveInstructorName(companyId: string, name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return loadSavedInstructorNames(companyId);
  const existing = loadSavedInstructorNames(companyId);
  const next = [...existing];
  if (!next.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
    next.push(trimmed);
    next.sort((a, b) => a.localeCompare(b));
    localStorage.setItem(storageKey(companyId), JSON.stringify(next));
  }
  return next;
}

export async function fetchSwimLessonInstructorOptions(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<string[]> {
  const [{ data: staffRows }, { data: lessonRows }] = await Promise.all([
    supabase
      .from("staff")
      .select("name, role, department, specialty_sports")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("name"),
    supabase.from("swim_lessons").select("instructor").eq("company_id", companyId),
  ]);

  const lifeguardNames = new Set<string>();
  for (const row of staffRows ?? []) {
    if (!row.name?.trim() || !isSwimLessonLifeguardStaff(row)) continue;
    lifeguardNames.add(row.name.trim());
  }

  const lifeguardKeys = new Set([...lifeguardNames].map((n) => n.toLowerCase()));

  const names = new Set<string>(lifeguardNames);

  for (const saved of loadSavedInstructorNames(companyId)) {
    if (lifeguardKeys.has(saved.toLowerCase())) names.add(saved);
  }

  for (const row of lessonRows ?? []) {
    const instructor = row.instructor?.trim();
    if (instructor && lifeguardKeys.has(instructor.toLowerCase())) {
      names.add(instructor);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
