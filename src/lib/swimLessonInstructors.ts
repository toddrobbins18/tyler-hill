import type { SupabaseClient } from "@supabase/supabase-js";

const storageKey = (companyId: string) => `swim-lesson-instructors:${companyId}`;

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
      .select("name")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("name"),
    supabase.from("swim_lessons").select("instructor").eq("company_id", companyId),
  ]);

  const names = new Set<string>();
  for (const name of loadSavedInstructorNames(companyId)) names.add(name);
  for (const row of staffRows ?? []) {
    if (row.name?.trim()) names.add(row.name.trim());
  }
  for (const row of lessonRows ?? []) {
    if (row.instructor?.trim()) names.add(row.instructor.trim());
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
