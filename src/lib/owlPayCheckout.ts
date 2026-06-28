import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwlPayCartPricing } from "./owlPayFreeItem";

export type OwlPayPurchaseRow = {
  child_id: string | null;
  staff_id: string | null;
  company_id: string;
  item_id: string;
  amount: number;
  is_free: boolean;
  transaction_type: "purchase";
  created_by?: string | null;
  notes?: string;
};

export function sumOwlPayChargeAmount(rows: OwlPayPurchaseRow[]): number {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export async function isFreeDailyItemAvailableToday(
  supabase: SupabaseClient,
  companyId: string,
  childId: string,
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("owl_pay_daily_scans")
    .select("id")
    .eq("company_id", companyId)
    .eq("child_id", childId)
    .eq("scan_date", today)
    .maybeSingle();

  if (error) throw error;
  return !data;
}

export type CompleteOwlPayCheckoutInput = {
  companyId: string;
  childId: string | null;
  staffId: string | null;
  createdBy?: string | null;
  pricing: OwlPayCartPricing;
  transactions: OwlPayPurchaseRow[];
};

export type CompleteOwlPayCheckoutResult = {
  new_balance: number | null;
  charge_total: number;
  free_item_applied: boolean;
};

/** Single atomic checkout: daily scan + transaction rows + balance deduction. */
export async function completeOwlPayCheckout(
  supabase: SupabaseClient,
  input: CompleteOwlPayCheckoutInput,
): Promise<CompleteOwlPayCheckoutResult> {
  const chargeTotal = sumOwlPayChargeAmount(input.transactions);

  const { data, error } = await supabase.rpc("complete_owl_pay_purchase", {
    _company_id: input.companyId,
    _child_id: input.childId,
    _staff_id: input.staffId,
    _created_by: input.createdBy ?? null,
    _charge_total: chargeTotal,
    _record_free_daily_scan: input.pricing.freeItemApplied && !!input.childId,
    _transactions: input.transactions,
  });

  if (error) throw error;

  const row = (data ?? {}) as CompleteOwlPayCheckoutResult;
  return {
    new_balance: row.new_balance ?? null,
    charge_total: Number(row.charge_total ?? chargeTotal),
    free_item_applied: Boolean(row.free_item_applied ?? input.pricing.freeItemApplied),
  };
}
