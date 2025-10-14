import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0];

    // Find medications that should have been administered by now but weren't
    const { data: missedMeds, error } = await supabase
      .from("medication_logs")
      .select("*, children(name, leader_id), staff(name, email)")
      .eq("date", today)
      .eq("administered", false)
      .eq("alert_sent", false)
      .lte("scheduled_time", currentTime);

    if (error) {
      console.error("Error fetching missed medications:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${missedMeds?.length || 0} missed medications`);

    // Send alerts for each missed medication
    for (const med of missedMeds || []) {
      // Get the leader's email
      if (med.children?.leader_id) {
        const { data: leader } = await supabase
          .from("staff")
          .select("email, name")
          .eq("id", med.children.leader_id)
          .single();

        if (leader?.email) {
          // Create a message in the system
          const { error: messageError } = await supabase
            .from("messages")
            .insert({
              subject: `Missed Medication Alert: ${med.children.name}`,
              content: `${med.children.name} has not received their ${med.medication_name} (${med.dosage}) scheduled for ${med.scheduled_time} today.`,
              sender_id: null, // System message
              recipient_id: (await supabase
                .from("profiles")
                .select("id")
                .eq("email", leader.email)
                .single()).data?.id,
            });

          if (messageError) {
            console.error("Error creating message:", messageError);
          }

          console.log(`Alert sent for ${med.children.name} to ${leader.name}`);
        }
      }

      // Mark alert as sent
      await supabase
        .from("medication_logs")
        .update({ alert_sent: true })
        .eq("id", med.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertsSent: missedMeds?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in check-medication-alerts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
