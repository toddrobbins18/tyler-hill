import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { medicationSlotKey, type MedicationLogRow } from "./medicationSchedule";

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
  let result = await supabase.from("medication_logs").update(update).eq("id", id).select("id");
  if (isMissingRefusalColumnError(result.error)) {
    result = await supabase
      .from("medication_logs")
      .update(stripRefusalFields(update))
      .eq("id", id)
      .select("id");
  }
  return result;
}

export async function findRecurringTemplateId(
  supabase: SupabaseClient<Database>,
  med: Pick<
    MedicationLogRow,
    "id" | "child_id" | "medication_name" | "meal_time" | "is_recurring" | "_templateId"
  > & { company_id?: string | null; season?: string | null },
): Promise<string | null> {
  if (med._templateId) return med._templateId;
  if (med.is_recurring) return med.id;

  if (!med.company_id || !med.season) return null;

  const slotKey = medicationSlotKey(med);
  const { data, error } = await supabase
    .from("medication_logs")
    .select("id, child_id, medication_name, meal_time")
    .eq("child_id", med.child_id)
    .eq("company_id", med.company_id)
    .eq("season", med.season)
    .eq("is_recurring", true);

  if (error) throw error;

  const match = (data || []).find((row) => medicationSlotKey(row) === slotKey);
  return match?.id ?? null;
}

export function medicationUpdateAffectedNoRows(
  data: { id: string }[] | null,
  error: PostgrestError | null,
): boolean {
  return !error && (!data || data.length === 0);
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
