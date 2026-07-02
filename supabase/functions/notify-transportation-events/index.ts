import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailType, sendEmailNotifications } from "../_shared/emailHelpers.ts";
import { buildTransportationNotification } from "../_shared/transportationNotificationContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { type, source = "trips", record, old_record } = await req.json();
    console.log(`Processing transportation event: ${type} (${source})`);

    if (!record?.company_id) {
      return new Response(
        JSON.stringify({ message: "Missing company_id on record" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const { data: config } = await supabase
      .from("automated_email_config")
      .select("enabled, send_timing")
      .eq("email_type", "transportation_events")
      .eq("company_id", record.company_id)
      .maybeSingle();

    if (!config?.enabled) {
      console.log("transportation_events disabled for company");
      return new Response(
        JSON.stringify({ message: "Transportation notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const sendTimings = config.send_timing ?? ["on_create"];
    const timingKey = type === "INSERT" ? "on_create" : "on_update";
    if (!sendTimings.includes(timingKey)) {
      console.log(`Skipping ${timingKey}; configured timings:`, sendTimings);
      return new Response(
        JSON.stringify({ message: `Timing ${timingKey} not enabled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const recipients = await getRecipientsForEmailType(
      supabase,
      "transportation_events",
      record.company_id,
    );

    if (!recipients.length) {
      console.log("No recipients configured for transportation events");
      return new Response(
        JSON.stringify({ message: "No recipients configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { subject, content } = buildTransportationNotification({
      type,
      source,
      record,
      old_record,
    });

    await sendEmailNotifications(supabase, recipients, subject, content, record.company_id);

    console.log(`Successfully sent transportation notifications to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        recipients_notified: recipients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-transportation-events:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
