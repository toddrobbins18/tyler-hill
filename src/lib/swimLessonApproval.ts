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
      rejection_reason: reason?.trim() || null,
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
