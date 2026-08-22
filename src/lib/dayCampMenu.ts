import type { LucideIcon } from "lucide-react";
import {
  Home,
  Sun,
  Truck,
  ClipboardEdit,
  Waves,
  FileBarChart,
  HeartPulse,
  Users,
  UserCog,
  Mail,
  Calendar,
  Utensils,
  FileText,
  Palmtree,
  CloudRain,
  Stethoscope,
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

/** Todd carryover — existing Nest modules (same labels/UX as The Nest). */
export function getDayCampNestCarryoverItems(): DayCampMenuItem[] {
  return [
    { title: "Activities & Field Trips", url: "/activities", icon: Palmtree, menuId: "activities" },
    { title: "Appointments", url: "/appointments", icon: Stethoscope, menuId: "appointments" },
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
    { title: "Bunking", url: "/day-camp/bunking", icon: BedDouble, menuId: "bunking" },
    { title: "Hiring", url: "/day-camp/hiring", icon: Briefcase, menuId: "hiring" },
    { title: "Media", url: "/day-camp/media", icon: Camera, menuId: "media" },
    { title: "Swim Lessons", url: "/day-camp/swim-lessons", icon: Waves, menuId: "swim-lessons" },
    { title: "Sunshine Report", url: "/day-camp/sunshine-report", icon: Sun, menuId: "sunshine-report" },
    { title: "Transportation", url: "/transportation", icon: Truck, menuId: "transportation" },
    { title: "Office Changes", url: "/day-camp/office-changes", icon: ClipboardEdit, menuId: "office-changes" },
    { title: "Swim", url: "/day-camp/swim", icon: Waves, menuId: "swim" },
  ];
}

/** North Shore Phase 1 — hide Hiring, Media per Todd (Jul 30). Bunking enabled for roster grouping. */
const NORTH_SHORE_SKIP_POC_MENU_IDS = new Set(["hiring", "media"]);

/** Day Camp POC items scoped to the active company. */
export function getDayCampPocItemsForCompany(company: CampLike): DayCampMenuItem[] {
  return getDayCampPocItems().filter((item) => {
    if (isNorthShoreDayCamp(company?.slug) && NORTH_SHORE_SKIP_POC_MENU_IDS.has(item.menuId)) {
      return false;
    }
    if (item.menuId === "transportation" && !northShoreBusTransportEnabled(company)) {
      return false;
    }
    return true;
  });
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
