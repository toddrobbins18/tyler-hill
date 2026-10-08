import { CAMP_SLUG, isNestSandboxCompany } from "@/lib/camps";
import { isSandboxDemoStaffEmail } from "@/lib/nestSandboxStaffDemo";

export const NEST_SANDBOX_MODE_KEY = "nest_sandbox_mode";
export const NEST_SANDBOX_RETURN_COMPANY_KEY = "nest_sandbox_return_company_id";

export const SANDBOX_COMPANY_SLUG = CAMP_SLUG.NEST_SANDBOX_DAY_CAMP;

export function isNestSandboxModeActive(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(NEST_SANDBOX_MODE_KEY) === "1";
}

export function setNestSandboxModeActive(active: boolean): void {
  if (typeof window === "undefined") return;
  if (active) {
    sessionStorage.setItem(NEST_SANDBOX_MODE_KEY, "1");
  } else {
    sessionStorage.removeItem(NEST_SANDBOX_MODE_KEY);
    sessionStorage.removeItem(NEST_SANDBOX_RETURN_COMPANY_KEY);
  }
}

export function stashReturnCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(NEST_SANDBOX_RETURN_COMPANY_KEY, companyId);
}

export function readReturnCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(NEST_SANDBOX_RETURN_COMPANY_KEY);
}

/** Training staff: land in sandbox on login (no main-portal / North Shore default). */
export function shouldAutoActivateSandboxOnLogin(options: {
  email?: string | null;
  profileCompanySlug?: string | null;
  allowedCompanySlugs: string[];
}): boolean {
  if (isSandboxDemoStaffEmail(options.email)) return true;
  if (isNestSandboxCompany(options.profileCompanySlug)) return true;
  if (
    options.allowedCompanySlugs.length === 1 &&
    isNestSandboxCompany(options.allowedCompanySlugs[0])
  ) {
    return true;
  }
  return false;
}
