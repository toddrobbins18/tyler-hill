import type { SupabaseClient } from "@supabase/supabase-js";

export type SwimLessonStatus = "pending" | "scheduled" | "rejected" | "cancelled";

export const SWIM_LESSON_STATUS_LABELS: Record<SwimLessonStatus, string> = {
  pending: "Pending approval",
  scheduled: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function isSwimLessonApproved(status: string | null | undefined): boolean {
  return status === "scheduled";
}

export function canParentConfirmLesson(status: string | null | undefined): boolean {
  return status === "scheduled";
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
  switch (status) {
    case "scheduled":
      return "default";
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
      status: "scheduled",
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
