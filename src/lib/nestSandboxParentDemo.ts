import type { SupabaseClient } from "@supabase/supabase-js";
import { CAMP_SLUG } from "@/lib/camps";
import type { Camper } from "@/lib/parentPortalConstants";

/** Season used for sandbox demo roster + parent portal training. */
export const SANDBOX_PARENT_DEMO_SEASON = "2027";

export const SANDBOX_DEMO_PARENT_DOMAIN = "@nest-demo.example";

export type SandboxDemoParentAccount = {
  key: string;
  label: string;
  email: string;
  guardianName: string;
  /** Shown on training cards — parents choose their own password at signup. */
  signupHint: string;
};

export const SANDBOX_DEMO_PARENT_ACCOUNTS: SandboxDemoParentAccount[] = [
  {
    key: "alpha",
    label: "Alpha family",
    email: "parent.alpha@nest-demo.example",
    guardianName: "Alex Alpha",
    signupHint: "Sign up with this email — Nest links 3 campers automatically.",
  },
  {
    key: "beta",
    label: "Beta family",
    email: "parent.beta@nest-demo.example",
    guardianName: "Blake Beta",
    signupHint: "Sign up with this email — Nest links 3 campers automatically.",
  },
  {
    key: "gamma",
    label: "Gamma family",
    email: "parent.gamma@nest-demo.example",
    guardianName: "Casey Gamma",
    signupHint: "Sign up with this email — Nest links 2 campers automatically.",
  },
];

export const PARENT_PORTAL_FLOW_STEPS = [
  {
    step: 1,
    title: "Roster has parent contact email",
    detail:
      "Each enrolled camper has guardian_email on file (CampMinder sync in production; sandbox seed script for training).",
  },
  {
    step: 2,
    title: "Parent creates a Nest login",
    detail: "Parent opens camp Parent Portal → Sign up with the same email as guardian_email on the roster.",
  },
  {
    step: 3,
    title: "Family profile + auto-link",
    detail:
      "register_parent_account creates a families row, then link_family_children_by_guardian_email attaches matching campers (siblings share guardian name + phone).",
  },
  {
    step: 4,
    title: "Parent uses the portal",
    detail: "My Campers, pickup changes, absences, authorized adults, and swim requests — all scoped to linked children.",
  },
] as const;

export function isSandboxParentDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(SANDBOX_DEMO_PARENT_DOMAIN);
}

export function sandboxParentAuthUrl(companySlug: string): string {
  return `/parents?company=${encodeURIComponent(companySlug)}`;
}

export async function fetchSandboxParentDemoRoster(
  supabase: SupabaseClient,
  companyId: string,
  guardianEmail: string,
  season: string = SANDBOX_PARENT_DEMO_SEASON,
): Promise<Camper[]> {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, grade, group_name, photo_url, status")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("guardian_email", guardianEmail)
    .neq("status", "inactive")
    .order("name");

  if (error) {
    console.warn("[SandboxParentDemo] roster load failed:", error.message);
    return [];
  }
  return (data ?? []) as Camper[];
}

export type SandboxDemoFamilySummary = SandboxDemoParentAccount & {
  camperCount: number;
  camperNames: string[];
};

/** Live counts from DB so training cards stay accurate after re-seed. */
export async function fetchSandboxParentDemoFamiliesSummary(
  supabase: SupabaseClient,
  companyId: string,
  season: string = SANDBOX_PARENT_DEMO_SEASON,
): Promise<SandboxDemoFamilySummary[]> {
  const summaries: SandboxDemoFamilySummary[] = [];

  for (const account of SANDBOX_DEMO_PARENT_ACCOUNTS) {
    const { data, error } = await supabase
      .from("children")
      .select("name")
      .eq("company_id", companyId)
      .eq("season", season)
      .eq("guardian_email", account.email)
      .neq("status", "inactive")
      .order("name");

    if (error) {
      summaries.push({ ...account, camperCount: 0, camperNames: [] });
      continue;
    }
    const names = (data ?? []).map((r) => r.name as string);
    summaries.push({
      ...account,
      camperCount: names.length,
      camperNames: names,
    });
  }

  return summaries;
}

export function isNestSandboxParentTraining(slug: string | null | undefined): boolean {
  return slug === CAMP_SLUG.NEST_SANDBOX_DAY_CAMP;
}
