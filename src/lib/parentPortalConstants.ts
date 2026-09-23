export const CAMP_STAFF_ROLES = new Set([
  "admin",
  "staff",
  "division_leader",
  "specialist",
  "viewer",
  "super_admin",
  "health_center",
]);

export function userIsCampStaff(roles: string[]): boolean {
  return roles.some((role) => CAMP_STAFF_ROLES.has(role));
}

export type ParentPortalView =
  | "home"
  | "campers"
  | "pickups"
  | "absences"
  | "authorized"
  | "swim";

export const PARENT_PORTAL_NAV: {
  id: ParentPortalView;
  label: string;
  mobileLabel: string;
}[] = [
  { id: "home", label: "Home", mobileLabel: "Home" },
  { id: "campers", label: "My Campers", mobileLabel: "Campers" },
  { id: "pickups", label: "Pickups", mobileLabel: "Pickup" },
  { id: "absences", label: "Absences", mobileLabel: "Absences" },
  { id: "authorized", label: "Authorized Adults", mobileLabel: "More" },
  { id: "swim", label: "Swim", mobileLabel: "Swim" },
];

export const CHANGE_TYPES = [
  { v: "early_pickup", l: "Early Pickup" },
  { v: "late_stay", l: "Late Stay" },
  { v: "alternate_guardian", l: "Alternate Guardian" },
  { v: "bus_change", l: "Bus / Transport Change" },
  { v: "other", l: "Other" },
] as const;

export const ABSENCE_TYPES = [
  { v: "absent", l: "Absent" },
  { v: "late_arrival", l: "Late Arrival" },
  { v: "leaving_early", l: "Leaving Early" },
] as const;

export type Camper = {
  id: string;
  name: string;
  grade?: string | null;
  group_name?: string | null;
  photo_url?: string | null;
  status?: string | null;
};

export type PickupChange = {
  id: string;
  camper_id: string;
  change_date: string;
  change_type: string;
  pickup_time: string | null;
  pickup_person_name: string | null;
  pickup_person_phone: string | null;
  notes: string | null;
  status: string;
};

export type Absence = {
  id: string;
  camper_id: string;
  absence_date: string;
  absence_type: string;
  arrival_time: string | null;
  reason: string | null;
  notes: string | null;
  status: string;
};

export type AuthorizedPickup = {
  id: string;
  camper_id: string | null;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
};

export type SwimLesson = {
  id: string;
  camper_id: string;
  scheduled_at: string;
  duration_minutes: number;
  instructor: string | null;
  location: string | null;
  cost_cents: number;
  status: string;
  parent_confirmed: boolean;
  parent_confirmed_at: string | null;
  notes: string | null;
};

export function camperDisplayGroup(camper: Camper): string | null {
  const group = camper.group_name?.trim();
  if (group) return group;
  const grade = camper.grade?.trim();
  if (grade) return grade;
  return null;
}

export function camperInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatFriendlyDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function changeTypeLabel(value: string): string {
  return CHANGE_TYPES.find((t) => t.v === value)?.l ?? value.replace(/_/g, " ");
}

export function absenceTypeLabel(value: string): string {
  return ABSENCE_TYPES.find((t) => t.v === value)?.l ?? value.replace(/_/g, " ");
}

export function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "acknowledged") return "default";
  if (status === "completed") return "secondary";
  if (status === "cancelled") return "destructive";
  return "outline";
}

export function statusDisplayLabel(status: string): string {
  const labels: Record<string, string> = {
    submitted: "Pending",
    acknowledged: "Approved",
    completed: "Completed",
    cancelled: "Declined",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}
