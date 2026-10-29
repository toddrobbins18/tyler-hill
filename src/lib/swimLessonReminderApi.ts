import { supabase } from "@/integrations/supabase/client";

export type SwimLessonReminderResult =
  | {
      success: true;
      targetDay: string;
      days_ahead: number;
      processed: number;
      results: Array<
        | { lesson_id: string; status: "sent"; recipient: string }
        | { lesson_id: string; status: "preview"; recipient: string; subject: string }
        | { lesson_id: string; status: "skipped"; reason: string }
        | { lesson_id: string; status: "failed"; error: string }
      >;
    }
  | { success: false; error: string };

export async function runSwimLessonReminders(params: {
  companyId: string;
  daysAhead?: number;
  previewOnly?: boolean;
}): Promise<SwimLessonReminderResult> {
  const { data, error } = await supabase.functions.invoke("process-swim-lesson-reminders", {
    body: {
      company_id: params.companyId,
      days_ahead: params.daysAhead ?? 3,
      preview_only: params.previewOnly === true,
    },
  });

  if (error) {
    return { success: false, error: error.message || "Failed to run swim lesson reminders" };
  }

  if (!data?.success) {
    return { success: false, error: String(data?.error ?? "Failed to run swim lesson reminders") };
  }

  return {
    success: true,
    targetDay: String(data.targetDay),
    days_ahead: Number(data.days_ahead),
    processed: Number(data.processed),
    results: Array.isArray(data.results) ? data.results : [],
  };
}
