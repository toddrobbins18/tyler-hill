import type { SupabaseClient } from "@supabase/supabase-js";

export type SwimLessonStatus = "pending" | "booked" | "scheduled" | "rejected" | "cancelled";

/** Status values that mean the lesson is on the calendar (staff approved). */
export const SWIM_LESSON_BOOKED_STATUSES = ["booked", "scheduled"] as const;

export function isSwimLessonBookedStatus(status: string | null | undefined): boolean {
  return status === "booked" || status === "scheduled";
}

export const SWIM_LESSON_STATUS_LABELS: Record<string, string> = {
  pending: "Pending approval",
  booked: "Booked",
  scheduled: "Booked",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function swimLessonStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return SWIM_LESSON_STATUS_LABELS[status] ?? status;
}

export function swimParentApprovalLabel(parentConfirmed: boolean): "Pending" | "Approved" {
  return parentConfirmed ? "Approved" : "Pending";
}

export function swimTransportApprovalLabel(
  parentConfirmed: boolean,
  transportStatus: string | null | undefined,
): "—" | "Pending" | "Approved" {
  if (!parentConfirmed) return "—";
  if (transportStatus === "acknowledged") return "Approved";
  return "Pending";
}

export function isSwimLessonApproved(status: string | null | undefined): boolean {
  return isSwimLessonBookedStatus(status);
}

export function canParentConfirmLesson(status: string | null | undefined): boolean {
  return isSwimLessonBookedStatus(status);
}

/** Fix common typos before save / parent-facing display. */
export function normalizeSwimLessonRejectionReason(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\bavailible\b/gi, "available");
}

/** Parent portal copy for declined lessons. */
export function formatSwimLessonRejectionForParent(reason: string | null | undefined): string {
  const normalized = normalizeSwimLessonRejectionReason(reason);
  if (!normalized) return "";
  if (/^not available\.?$/i.test(normalized)) return "Not available";
  return normalized;
}

export const SWIM_LESSON_REJECTION_DEFAULT = "Not available";

export function swimLessonStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (isSwimLessonBookedStatus(status)) return "default";
  switch (status) {
    case "pending":
      return "outline";
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

export async function approveSwimLessonRequest(
  supabase: SupabaseClient,
  id: string,
  userId?: string | null,
) {
  return supabase
    .from("swim_lessons")
    .update({
      status: "booked",
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId ?? null,
    })
    .eq("id", id)
    .eq("status", "pending");
}

export async function rejectSwimLessonRequest(
  supabase: SupabaseClient,
  id: string,
  reason?: string | null,
  userId?: string | null,
) {
  return supabase
    .from("swim_lessons")
    .update({
      status: "rejected",
      rejection_reason: normalizeSwimLessonRejectionReason(reason),
      parent_confirmed: false,
      parent_confirmed_at: null,
      transport_status: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId ?? null,
    })
    .eq("id", id)
    .eq("status", "pending");
}

export async function cancelSwimLessonRequest(supabase: SupabaseClient, id: string) {
  return supabase
    .from("swim_lessons")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");
}
