import type { CampLike } from "@/lib/camps";
import {
  appointmentsEnabledForCompany,
  isDayCampCompany,
  staffTimeClockEnabledForCompany,
} from "@/lib/camps";
import {
  getDayCampMainMenuItems,
  getDayCampPocItemsForCompany,
  getDayCampSidebarPocItems,
} from "@/lib/dayCampMenu";
import { getOvernightMenuItems } from "@/lib/overnightMenu";

const ALWAYS_ALLOWED_EXACT = new Set([
  "/admin",
  "/evaluation-questions",
  "/role-permissions",
  "/division-permissions",
  "/specialist-sport-assignments",
  "/user-approvals",
  "/notification-preferences",
]);

const ALWAYS_ALLOWED_PREFIXES = ["/staff/", "/child/"];

function normalizePath(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.replace(/\/$/, "") || "/";
}

function getAllowedPathsForCompany(company: CampLike): Set<string> {
  const paths = new Set<string>();

  if (isDayCampCompany(company)) {
    for (const item of getDayCampMainMenuItems()) {
      paths.add(item.url);
    }
    for (const item of getDayCampSidebarPocItems(company)) {
      paths.add(item.url);
    }
    paths.add("/day-camp/parent-portal-dashboard");
    paths.add("/parents");
    paths.add("/parents/portal");
  } else {
    for (const item of getOvernightMenuItems(company)) {
      if (item.menuId === "staff-time-clock" && !staffTimeClockEnabledForCompany(company)) {
        continue;
      }
      if (item.menuId === "appointments" && !appointmentsEnabledForCompany(company)) {
        continue;
      }
      paths.add(item.url);
    }
  }

  // Route aliases that mirror day-camp module paths.
  paths.add("/hiring");
  paths.add("/media");
  paths.add("/sunshine-report");

  return paths;
}

function isDayCampModulePath(path: string, company: CampLike): boolean {
  if (!path.startsWith("/day-camp/")) return false;
  const moduleId = path.slice("/day-camp/".length);
  if (!moduleId || moduleId.includes("/")) return false;
  return getDayCampPocItemsForCompany(company).some(
    (item) => item.url === path || item.url.endsWith(`/${moduleId}`),
  );
}

/** Whether the current URL belongs to the active camp's navigation (ignores role permissions). */
export function isRouteAllowedForCompany(pathname: string, company: CampLike | null | undefined): boolean {
  if (!company) return true;

  const path = normalizePath(pathname);

  if (ALWAYS_ALLOWED_EXACT.has(path)) return true;
  if (ALWAYS_ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;

  const allowed = getAllowedPathsForCompany(company);
  if (allowed.has(path)) return true;

  if (isDayCampCompany(company) && isDayCampModulePath(path, company)) {
    return true;
  }

  return false;
}
