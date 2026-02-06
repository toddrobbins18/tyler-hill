import { supabase } from "@/integrations/supabase/client";

interface NotifyStaffParams {
  staffNames: string[];
  eventTitle: string;
  eventDate: string;
  eventType: "activity" | "special_event" | "trip";
  companyId: string;
}

/**
 * Notify staff members when assigned to activities/events.
 * Sends both in-app and email notifications via edge function.
 * Fire-and-forget: errors are logged but don't block the UI.
 */
export async function notifyStaffAssignment({
  staffNames,
  eventTitle,
  eventDate,
  eventType,
  companyId,
}: NotifyStaffParams): Promise<void> {
  if (!staffNames.length || !companyId) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await supabase.functions.invoke("notify-staff-assignment", {
      body: { staffNames, eventTitle, eventDate, eventType, companyId },
    });

    if (response.error) {
      console.error("Staff notification error:", response.error);
    } else {
      console.log("Staff notification sent:", response.data);
    }
  } catch (err) {
    console.error("Failed to send staff assignment notification:", err);
  }
}
