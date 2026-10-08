import type { SupabaseClient } from "@supabase/supabase-js";

export type CamperSwimLessonRow = {
  id: string;
  camper_id: string;
  scheduled_at: string;
  duration_minutes: number;
  instructor: string | null;
  location: string | null;
  status: string;
  parent_confirmed: boolean;
  transport_status: string | null;
  notes: string | null;
};

/** Private swim lessons (`swim_lessons`) for this camper — includes other seasons via person_id. */
export async function fetchSwimLessonsForCamper(
  supabase: SupabaseClient,
  companyId: string,
  childId: string,
  personId?: string | null,
): Promise<CamperSwimLessonRow[]> {
  const camperIds = new Set<string>([childId]);

  if (personId) {
    const { data: siblingRows } = await supabase
      .from("children")
      .select("id")
      .eq("company_id", companyId)
      .eq("person_id", personId);
    for (const row of siblingRows ?? []) {
      if (row.id) camperIds.add(row.id);
    }
  }

  const { data, error } = await supabase
    .from("swim_lessons")
    .select(
      "id, camper_id, scheduled_at, duration_minutes, instructor, location, status, parent_confirmed, transport_status, notes",
    )
    .eq("company_id", companyId)
    .in("camper_id", Array.from(camperIds))
    .order("scheduled_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CamperSwimLessonRow[];
}
