import type { LucideIcon } from "lucide-react";
import {
  Home,
  Sun,
  Truck,
  Bus,
  ClipboardEdit,
  ClipboardList,
  Radio,
  FileText,
  Clock,
  Waves,
  FileBarChart,
  HeartPulse,
  Users,
  UserCog,
  Mail,
  Calendar,
  Utensils,
  Palmtree,
  CloudRain,
  BookOpen,
  AlertTriangle,
  Briefcase,
  BedDouble,
  Camera,
} from "lucide-react";
import type { CampLike } from "@/lib/camps";
import { isNorthShoreDayCamp, northShoreBusTransportEnabled } from "@/lib/camps";

export type DayCampMenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  menuId: string;
};

/** Staff transport tools — linked from Front Office, not top-level sidebar. */
export const FRONT_OFFICE_TRANSPORT_MENU_IDS = new Set([
  "transport-admin",
  "bus-attendance",
  "change-sheets",
  "pending-transport-changes",
  "group-bubble-sheets",
]);

/** Bus transport modules — gated when North Shore bus transport is disabled. */
const BUS_TRANSPORT_MENU_IDS = new Set(["transportation", ...FRONT_OFFICE_TRANSPORT_MENU_IDS]);

/** Parent-facing staff tools — Parent Portal section in sidebar. */
export const PARENT_PORTAL_MENU_IDS = new Set(["parent-portal", "parent-portal-dashboard"]);

/** Todd carryover — existing Nest modules (same labels/UX as The Nest). */
export function getDayCampNestCarryoverItems(): DayCampMenuItem[] {
  return [
    { title: "Activities & Field Trips", url: "/activities", icon: Palmtree, menuId: "activities" },
    { title: "Tutoring & Therapy", url: "/tutoring-therapy", icon: BookOpen, menuId: "tutoring-therapy" },
    { title: "Camper", url: "/roster", icon: Users, menuId: "roster" },
    { title: "Daily news", url: "/notes", icon: FileText, menuId: "notes" },
    { title: "Dashboard", url: "/", icon: Home, menuId: "dashboard" },
    { title: "Incident Reports", url: "/incidents", icon: AlertTriangle, menuId: "incidents" },
    { title: "Master Calendar", url: "/calendar", icon: Calendar, menuId: "calendar" },
    { title: "Menu", url: "/menu", icon: Utensils, menuId: "menu" },
    { title: "Messages", url: "/messages", icon: Mail, menuId: "messages" },
    { title: "Health Center", url: "/day-camp/nurse", icon: HeartPulse, menuId: "nurse" },
    { title: "Rainy Day Schedule", url: "/rainy-day", icon: CloudRain, menuId: "rainy-day" },
    { title: "Special Events", url: "/special-events", icon: Calendar, menuId: "special-events" },
    { title: "Staff", url: "/staff", icon: UserCog, menuId: "staff" },
  ];
}

/** Nest 2.0 / Airtable POC — Day Camp features (Jul 30 North Shore priorities). */
export function getDayCampPocItems(): DayCampMenuItem[] {
  return [
    { title: "Front Office", url: "/day-camp/front-office", icon: Radio, menuId: "front-office" },
    { title: "Transport Admin", url: "/day-camp/transport-admin", icon: Bus, menuId: "transport-admin" },
    { title: "Bunking", url: "/day-camp/bunking", icon: BedDouble, menuId: "bunking" },
    { title: "Hiring", url: "/day-camp/hiring", icon: Briefcase, menuId: "hiring" },
    { title: "Media", url: "/day-camp/media", icon: Camera, menuId: "media" },
    { title: "Swim Lessons", url: "/day-camp/swim-lessons", icon: Waves, menuId: "swim-lessons" },
    { title: "Sunshine Report", url: "/day-camp/sunshine-report", icon: Sun, menuId: "sunshine-report" },
    { title: "Transportation", url: "/day-camp/transport", icon: Truck, menuId: "transportation" },
    { title: "Bus Attendance", url: "/day-camp/bus-attendance", icon: ClipboardList, menuId: "bus-attendance" },
    { title: "Group Bubble Sheets", url: "/day-camp/group-bubble-sheets", icon: Users, menuId: "group-bubble-sheets" },
    { title: "Change Sheets", url: "/day-camp/change-sheets", icon: FileText, menuId: "change-sheets" },
    { title: "Pending Changes", url: "/day-camp/pending-transport-changes", icon: Clock, menuId: "pending-transport-changes" },
    { title: "Office Changes", url: "/day-camp/office-changes", icon: ClipboardEdit, menuId: "office-changes" },
    { title: "Swim", url: "/day-camp/swim", icon: Waves, menuId: "swim" },
  ];
}

/** North Shore Phase 1 — hide Media per Todd (Jul 30). Bunking + Hiring enabled for roster. */
const NORTH_SHORE_SKIP_POC_MENU_IDS = new Set(["media"]);

function isTransportMenuItem(menuId: string): boolean {
  return BUS_TRANSPORT_MENU_IDS.has(menuId);
}

/** Day Camp POC items scoped to the active company (includes all modules for permissions). */
export function getDayCampPocItemsForCompany(company: CampLike): DayCampMenuItem[] {
  return getDayCampPocItems().filter((item) => {
    if (isNorthShoreDayCamp(company?.slug) && NORTH_SHORE_SKIP_POC_MENU_IDS.has(item.menuId)) {
      return false;
    }
    if (isTransportMenuItem(item.menuId) && !northShoreBusTransportEnabled(company)) {
      return false;
    }
    return true;
  });
}

/** Day Camp sidebar — excludes Front Office transport links and Parent Portal items. */
export function getDayCampSidebarPocItems(company: CampLike): DayCampMenuItem[] {
  return getDayCampPocItemsForCompany(company).filter(
    (item) =>
      !FRONT_OFFICE_TRANSPORT_MENU_IDS.has(item.menuId) &&
      !PARENT_PORTAL_MENU_IDS.has(item.menuId),
  );
}

/** Transport shortcuts rendered on the Front Office dashboard. */
export function getFrontOfficeTransportMenuItems(company: CampLike): DayCampMenuItem[] {
  return getDayCampPocItemsForCompany(company).filter((item) =>
    FRONT_OFFICE_TRANSPORT_MENU_IDS.has(item.menuId),
  );
}

export function getParentPortalMenuItems(): DayCampMenuItem[] {
  return [
    {
      title: "Parent Portal",
      url: "/parents",
      icon: Users,
      menuId: "parent-portal",
    },
    {
      title: "Portal Dashboard",
      url: "/day-camp/parent-portal-dashboard",
      icon: ClipboardList,
      menuId: "parent-portal-dashboard",
    },
  ];
}

/** Todd carryover — sorted for Main Menu (same Nest sidebar style). */
export function getDayCampMainMenuItems(): DayCampMenuItem[] {
  return [...getDayCampNestCarryoverItems()].sort((a, b) => a.title.localeCompare(b.title));
}

/** Day Camp POC items — sorted for Day Camp menu section. */
export function getDayCampMenuPocItemsSorted(): DayCampMenuItem[] {
  return [...getDayCampPocItems()].sort((a, b) => a.title.localeCompare(b.title));
}

/** Role permission rows for day camps — mirrors AppSidebar Main Menu + Day Camp sections. */
export function getDayCampRolePermissionMenuItems() {
  const toRow = (menuId: string, label: string, icon: string) => ({ id: menuId, label, icon });
  const rows = [
    ...getDayCampNestCarryoverItems().map((item) => toRow(item.menuId, item.title, "📋")),
    ...getDayCampPocItems().map((item) => toRow(item.menuId, item.title, "🏕️")),
    toRow("admin", "Admin Panel", "⚙️"),
    toRow("evaluation-questions", "Evaluation Questions", "📋"),
    toRow("role-permissions", "Role Permissions", "🔒"),
    toRow("division-permissions", "Division Permissions", "🔐"),
    toRow("specialist-sport-assignments", "Specialist Sport Assignments", "🏅"),
    toRow("user-approvals", "User Approvals", "✅"),
  ];
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}
