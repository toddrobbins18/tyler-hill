import type { SupabaseClient } from "@supabase/supabase-js";
import { isNestSandboxCompany } from "@/lib/camps";
import { SANDBOX_PARENT_DEMO_SEASON } from "@/lib/nestSandboxParentDemo";

/** Season where sandbox transport_boards seed lives — not North Shore MapPoint 2026. */
export const SANDBOX_TRANSPORT_BOARD_SEASON = SANDBOX_PARENT_DEMO_SEASON;

export async function fetchCompanySlug(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("slug")
    .eq("id", companyId)
    .maybeSingle();
  if (error) {
    console.warn("[nestSandboxTransport] slug lookup failed:", error.message);
    return null;
  }
  return data?.slug ?? null;
}

export async function isSandboxTransportCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  const slug = await fetchCompanySlug(supabase, companyId);
  return isNestSandboxCompany(slug);
}

export function isSandboxTransportSlug(slug: string | null | undefined): boolean {
  return isNestSandboxCompany(slug);
}
