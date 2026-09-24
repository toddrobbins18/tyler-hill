import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardCheck,
  ClipboardEdit,
  ClipboardPen,
  Clock,
  CreditCard,
  FileText,
  Home,
  ListChecks,
  Mail,
  Palmtree,
  Pill,
  Stethoscope,
  Trophy,
  Truck,
  UserCog,
  Users,
  Utensils,
  CloudRain,
  AlertTriangle,
} from "lucide-react";
import type { CampLike } from "@/lib/camps";
import {
  isTimberLakeWestCompany,
  isTylerHillCamp,
  shouldShowTigerTimes,
} from "@/lib/camps";

export type OvernightMenuItem = {
  title: string;
  url: string;
  icon: typeof Home;
  menuId: string;
  external?: boolean;
};

/** Overnight camp sidebar items — shared by AppSidebar and camp route guard. */
export function getOvernightMenuItems(company?: CampLike): OvernightMenuItem[] {
  const companySlug = company?.slug;
  const isWest = isTimberLakeWestCompany(company);
  const isCamp = shouldShowTigerTimes(company);
  const baseItems: OvernightMenuItem[] = [
    { title: isWest ? "Athletics" : "Sports Calendar", url: "/athletics", icon: Trophy, menuId: "sports-calendar" },
    { title: "Camper", url: "/roster", icon: Users, menuId: "roster" },
    { title: "Dashboard", url: "/", icon: Home, menuId: "dashboard" },
    { title: "Master Calendar", url: "/calendar", icon: Calendar, menuId: "calendar" },
    { title: "Menu", url: "/menu", icon: Utensils, menuId: "menu" },
    { title: "Rainy Day Schedule", url: "/rainy-day", icon: CloudRain, menuId: "rainy-day" },
    {
      title: isWest ? "Special Events" : "Special Events & Evening Activities",
      url: "/special-events",
      icon: Calendar,
      menuId: "special-events",
    },
    { title: "Staff", url: "/staff", icon: UserCog, menuId: "staff" },
    { title: "Tutoring & Therapy", url: "/tutoring-therapy", icon: BookOpen, menuId: "tutoring-therapy" },
  ];

  baseItems.push(
    { title: "Activities & Field Trips", url: "/activities", icon: Palmtree, menuId: "activities" },
    { title: "Messages", url: "/messages", icon: Mail, menuId: "messages" },
    { title: "Transportation", url: "/transportation", icon: Truck, menuId: "transportation" },
    { title: "OD Management", url: "/od-management", icon: ClipboardCheck, menuId: "od-management" },
    { title: "Staff Time Clock", url: "/staff-time-clock", icon: Clock, menuId: "staff-time-clock" },
    { title: "Appointments", url: "/appointments", icon: Stethoscope, menuId: "appointments" },
  );

  if (isCamp) {
    baseItems.push({ title: "Daily Schedule", url: "/daily-schedule", icon: Calendar, menuId: "daily-schedule" });
  }

  baseItems.push({ title: "Special Meals", url: "/special-meals", icon: Utensils, menuId: "special-meals" });

  if (isTylerHillCamp(companySlug)) {
    baseItems.push({ title: "Owl Pay", url: "/owl-pay", icon: CreditCard, menuId: "owl-pay" });
  }

  baseItems.push({
    title: isTylerHillCamp(companySlug) ? "Daily News" : "Daily Notes",
    url: "/notes",
    icon: FileText,
    menuId: "notes",
  });

  if (isWest) {
    baseItems.push(
      { title: "Daily Wolf Printable", url: "/daily-wolf-printable", icon: FileText, menuId: "daily-wolf-printable" },
      { title: "Daily Wolf Management", url: "/daily-wolf-management", icon: ClipboardEdit, menuId: "daily-wolf-management" },
    );
  }

  if (isCamp) {
    baseItems.push(
      { title: "Tiger Times", url: "/daily-wolf-management", icon: ClipboardEdit, menuId: "daily-wolf-management" },
      { title: "Elective Sign-Up", url: "/elective-signup", icon: ClipboardPen, menuId: "elective-signup" },
    );
  }

  baseItems.push({ title: "Reports", url: "/reports", icon: BarChart3, menuId: "reports" });
  baseItems.push({ title: "Nurse", url: "/nurse", icon: Pill, menuId: "nurse" });
  baseItems.push(
    { title: "Awards", url: "/awards", icon: Award, menuId: "awards" },
    { title: "Incident Reports", url: "/incidents", icon: AlertTriangle, menuId: "incidents" },
    { title: "Sports Academy", url: "/sports-academy", icon: Trophy, menuId: "sports-academy" },
    { title: "Sports Academy Calendar", url: "/sports-academy-calendar", icon: Calendar, menuId: "sports-academy-calendar" },
    { title: "Roster Templates", url: "/roster-templates", icon: ListChecks, menuId: "roster-templates" },
  );

  return baseItems.sort((a, b) => a.title.localeCompare(b.title));
}
