import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupFamilyIdForCamper } from "@/lib/dismissalDashboard";

export type TransportFamilyCamper = {
  id: string;
  name: string;
  group_name: string | null;
};

export type TransportFamilyContext = {
  familyId: string | null;
  familyName: string | null;
  siblings: TransportFamilyCamper[];
};

/** Enrolled family members for transport log forms (current season roster). */
export async function lookupTransportFamilyEnrolledSiblings(
  supabase: SupabaseClient,
  companyId: string,
  camperId: string,
  enrolledCampers: TransportFamilyCamper[],
): Promise<TransportFamilyContext> {
  const familyId = await lookupFamilyIdForCamper(supabase, companyId, camperId);
  if (!familyId) {
    return { familyId: null, familyName: null, siblings: [] };
  }

  const [{ data: familyRow }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("families").select("family_name").eq("id", familyId).maybeSingle(),
    supabase
      .from("family_children")
      .select("child_id")
      .eq("family_id", familyId)
      .eq("company_id", companyId),
  ]);

  if (linksError) throw linksError;

  const enrolledById = new Map(enrolledCampers.map((c) => [c.id, c]));
  const siblings = (links ?? [])
    .map((row) => enrolledById.get(row.child_id as string))
    .filter((c): c is TransportFamilyCamper => c != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    familyId,
    familyName: (familyRow?.family_name as string | undefined) ?? null,
    siblings,
  };
}

/** Campers to include when submitting a transport log change. */
export function resolveTransportLogTargets(
  camperId: string,
  enrolledCampers: TransportFamilyCamper[],
  siblings: TransportFamilyCamper[],
  applyToSiblings: boolean,
): TransportFamilyCamper[] {
  const selected = enrolledCampers.find((c) => c.id === camperId);
  if (!selected) return [];
  if (applyToSiblings && siblings.length > 1) return siblings;
  return [selected];
}
