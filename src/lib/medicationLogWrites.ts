import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type MedicationLogUpdate = Database["public"]["Tables"]["medication_logs"]["Update"];
type MedicationLogInsert = Database["public"]["Tables"]["medication_logs"]["Insert"];

const REFUSAL_FIELD_NAMES = ["refused", "refused_by", "refused_at"] as const;

export function isMissingRefusalColumnError(error: PostgrestError | null): boolean {
  return error?.code === "42703" && /refused/i.test(error.message ?? "");
}

function stripRefusalFields<T extends Record<string, unknown>>(payload: T): T {
  const copy = { ...payload };
  for (const key of REFUSAL_FIELD_NAMES) {
    delete copy[key];
  }
  return copy;
}

export async function updateMedicationLog(
  supabase: SupabaseClient<Database>,
  id: string,
  update: MedicationLogUpdate,
) {
  let result = await supabase.from("medication_logs").update(update).eq("id", id);
  if (isMissingRefusalColumnError(result.error)) {
    result = await supabase
      .from("medication_logs")
      .update(stripRefusalFields(update))
      .eq("id", id);
  }
  return result;
}

export async function insertMedicationLog(
  supabase: SupabaseClient<Database>,
  row: MedicationLogInsert,
) {
  let result = await supabase.from("medication_logs").insert(row);
  if (isMissingRefusalColumnError(result.error)) {
    result = await supabase.from("medication_logs").insert(stripRefusalFields(row));
  }
  return result;
}

export function medicationWriteErrorDescription(
  error: PostgrestError | { message?: string } | null,
): string | undefined {
  if (!error?.message) return undefined;
  if (isMissingRefusalColumnError(error)) {
    return "The database is missing medication refusal columns. Run migration 20260701190000_add_medication_refusal_tracking.sql in Supabase.";
  }
  return error.message;
}
