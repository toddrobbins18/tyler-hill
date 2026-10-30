import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSwimLessonConfirmationReminder } from "../_shared/swimLessonReminderEmail.ts";
import { trySendM365Email } from "../_shared/m365SendMail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function addDaysUtc(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const company_id = body.company_id as string | undefined;
    const preview_only = body.preview_only === true;
    const days_ahead = Number(body.days_ahead ?? 3);

    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("SWIM_LESSON_REMINDER_CRON_SECRET");
    const isCron = cronSecret && req.headers.get("x-cron-secret") === cronSecret;

    let sentBy: string | null = null;
    if (!isCron) {
      if (!authHeader) throw new Error("Unauthorized");
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) throw new Error("Unauthorized");
      sentBy = user.id;

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = userRoles?.map((r) => r.role) ?? [];
      if (!roles.some((r) => ["admin", "super_admin", "staff"].includes(r))) {
        throw new Error("Insufficient permissions");
      }
    }

    if (!company_id) throw new Error("company_id is required");

    const targetDay = addDaysUtc(new Date().toISOString().slice(0, 10), days_ahead);
    const dayStart = `${targetDay}T00:00:00.000Z`;
    const dayEnd = `${targetDay}T23:59:59.999Z`;

    const { data: companyRow } = await supabase.from("companies").select("name").eq("id", company_id).maybeSingle();
    const campName = companyRow?.name ?? "North Shore Day Camp";

    const { data: lessons, error: lessonError } = await supabase
      .from("swim_lessons")
      .select("id, camper_id, scheduled_at, status, parent_confirmed, children:camper_id(name, guardian_email)")
      .eq("company_id", company_id)
      .in("status", ["booked", "scheduled"])
      .eq("parent_confirmed", false)
      .is("reminder_sent_at", null)
      .gte("scheduled_at", dayStart)
      .lte("scheduled_at", dayEnd);

    if (lessonError) throw new Error(lessonError.message);

    const results: Array<
      | { lesson_id: string; status: "sent"; recipient: string }
      | { lesson_id: string; status: "preview"; recipient: string; subject: string }
      | { lesson_id: string; status: "skipped"; reason: string }
      | { lesson_id: string; status: "failed"; error: string }
    > = [];

    for (const lesson of lessons ?? []) {
      const child = lesson.children as { name?: string; guardian_email?: string } | null;
      const email = child?.guardian_email?.trim();
      if (!email) {
        results.push({ lesson_id: lesson.id, status: "skipped", reason: "No parent email" });
        continue;
      }

      const rendered = buildSwimLessonConfirmationReminder({
        childName: child?.name ?? "your child",
        campName,
      });

      if (preview_only) {
        results.push({
          lesson_id: lesson.id,
          status: "preview",
          recipient: email,
          subject: rendered.subject,
        });
        continue;
      }

      const m365 = await trySendM365Email(supabase, company_id, {
        subject: rendered.subject,
        html: rendered.html,
        to: email,
        fromName: campName,
      });

      if (!m365.configured) {
        results.push({
          lesson_id: lesson.id,
          status: "preview",
          recipient: email,
          subject: rendered.subject,
        });
        continue;
      }

      if (!m365.sent) {
        results.push({ lesson_id: lesson.id, status: "failed", error: m365.error ?? "Send failed" });
        continue;
      }

      await supabase
        .from("swim_lessons")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", lesson.id);

      results.push({ lesson_id: lesson.id, status: "sent", recipient: email });
      if (sentBy) {
        await supabase.from("email_logs").insert({
          sent_by: sentBy,
          subject: rendered.subject,
          recipient_count: 1,
          recipient_ids: [lesson.camper_id],
          recipient_tags: ["swim_lesson:3day_reminder"],
          status: "sent",
          delivery_methods: { email: true, inApp: false },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        targetDay,
        days_ahead,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("process-swim-lesson-reminders error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
