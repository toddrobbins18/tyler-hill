import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { type, record } = await req.json();
    console.log("Processing notification for type:", type, "record:", record);

    // Find transportation director (staff with department 'Transportation' or role containing 'Transport')
    const { data: transportStaff, error: staffError } = await supabase
      .from("staff")
      .select("id, name, email")
      .or('department.ilike.%transport%,role.ilike.%transport%')
      .eq("status", "active");

    if (staffError) {
      console.error("Error finding transport staff:", staffError);
      throw staffError;
    }

    if (!transportStaff || transportStaff.length === 0) {
      console.log("No transportation staff found, skipping notification");
      return new Response(
        JSON.stringify({ message: "No transportation staff found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get profiles for the transport staff to find user_ids
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("email", transportStaff.map(s => s.email).filter(Boolean));

    if (!profiles || profiles.length === 0) {
      console.log("No profiles found for transportation staff");
      return new Response(
        JSON.stringify({ message: "No profiles found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create notification messages for each transportation staff member
    const messages = profiles.map(profile => ({
      recipient_id: profile.id,
      subject: `New ${type}: ${record.title || record.name}`,
      content: `A new ${type} has been scheduled:\n\nTitle: ${record.title || record.name}\nDate: ${record.event_date || record.date}\nLocation: ${record.location || record.destination || 'Not specified'}\n\nPlease review and arrange transportation as needed.`,
      read: false,
    }));

    const { error: messageError } = await supabase
      .from("messages")
      .insert(messages);

    if (messageError) {
      console.error("Error creating messages:", messageError);
      throw messageError;
    }

    console.log(`Sent ${messages.length} notifications to transportation staff`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: messages.length 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-transportation-events:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
