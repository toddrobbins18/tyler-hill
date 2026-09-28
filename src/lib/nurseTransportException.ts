import type { SupabaseClient } from "@supabase/supabase-js";

export function isHealthVisitSentHome(sentHome: string | null | undefined): boolean {
  const value = sentHome?.trim().toLowerCase();
  return value === "yes" || value === "y";
}

export function healthVisitCalledHomeToBoolean(
  calledHome: string | null | undefined,
): boolean {
  const value = calledHome?.trim().toLowerCase();
  return value === "yes" || value === "y";
}

export type NurseSentHomeTransportInput = {
  companyId: string;
  date: string;
  camperName: string;
  groupName?: string | null;
  reason?: string | null;
  nurseName?: string | null;
  counselorName?: string | null;
  calledHome?: boolean;
};

/** Queue a nurse sent-home bus exception for transport staff approval. */
export async function submitNurseSentHomeTransportException(
  supabase: SupabaseClient,
  input: NurseSentHomeTransportInput,
): Promise<{ id: string; created: boolean; skipped: boolean }> {
  const camperName = input.camperName.trim();
  if (!camperName) {
    throw new Error("Camper name is required for transport exception");
  }

  const { data: existing, error: findError } = await supabase
    .from("nurse_records")
    .select("id, transport_status")
    .eq("company_id", input.companyId)
    .eq("date", input.date)
    .eq("sent_home", true)
    .ilike("camper_name", camperName)
    .order("created_at", { ascending: false })
    .limit(1);

  if (findError) throw findError;

  const row = existing?.[0];
  if (row?.transport_status === "acknowledged") {
    return { id: row.id, created: false, skipped: true };
  }

  const payload = {
    company_id: input.companyId,
    date: input.date,
    camper_name: camperName,
    group_name: input.groupName?.trim() || null,
    reason: input.reason?.trim() || null,
    nurse_name: input.nurseName?.trim() || null,
    counselor: input.counselorName?.trim() || null,
    called_home: input.calledHome ?? false,
    sent_home: true,
    transport_status: "submitted" as const,
  };

  if (row?.id) {
    const { error } = await supabase.from("nurse_records").update(payload).eq("id", row.id);
    if (error) throw error;
    return { id: row.id, created: false, skipped: false };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("nurse_records")
    .insert(payload)
    .select("id")
    .single();

  if (insertError) throw insertError;
  return { id: inserted.id, created: true, skipped: false };
}
