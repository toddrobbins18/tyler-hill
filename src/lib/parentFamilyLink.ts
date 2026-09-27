import type { SupabaseClient } from "@supabase/supabase-js";

/** Match roster campers to a parent family by guardian email (+ siblings). */
export async function linkFamilyChildrenByGuardianEmail(
  supabase: SupabaseClient,
  familyId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("link_family_children_by_guardian_email", {
    _family_id: familyId,
  });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
