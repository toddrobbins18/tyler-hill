import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  getRecipientsForEmailTypeWithFilters, 
  sendEmailNotifications 
} from "../_shared/emailHelpers.ts";
import { calculateSendTime, buildTimingSubject, addTimingContext } from "../_shared/timingHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentPayload {
  appointment_id: string;
  action: 'create' | 'update';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload: AppointmentPayload = await req.json();
    const { appointment_id, action } = payload;

    console.log(`Processing appointment notification: ${action} for ${appointment_id}`);

    // Fetch the appointment with child/staff details
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select(`
        *,
        child:child_id(id, name, division_id),
        staff:staff_id(id, name, department)
      `)
      .eq("id", appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error("Error fetching appointment:", appointmentError);
      return new Response(JSON.stringify({ error: "Appointment not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = appointment.company_id;
    const personName = appointment.child?.name || appointment.staff?.name || "Unknown";
    const personType = appointment.child_id ? "Camper" : "Staff";
    const divisionId = appointment.child?.division_id;

    // Build notification content
    const content = `
${personType}: ${personName}
Type: ${appointment.appointment_type}
Date: ${appointment.appointment_date}${appointment.appointment_time ? ` at ${appointment.appointment_time}` : ''}
${appointment.provider_name ? `Provider: ${appointment.provider_name}` : ''}
${appointment.location ? `Location: ${appointment.location}` : ''}
${appointment.notes ? `\nNotes: ${appointment.notes}` : ''}
    `.trim();

    // Get recipients - filter by division if it's a camper
    const filters = divisionId ? { divisionIds: [divisionId] } : undefined;
    const recipients = await getRecipientsForEmailTypeWithFilters(
      supabase,
      'appointment',
      companyId,
      filters
    );

    if (recipients.length === 0) {
      console.log("No recipients configured for appointment notifications");
      return new Response(JSON.stringify({ message: "No recipients configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send immediate notification on create
    if (action === 'create') {
      const subject = `New Appointment: ${personName} - ${appointment.appointment_type}`;
      await sendEmailNotifications(supabase, recipients, subject, content, companyId);
      console.log(`Sent ${recipients.length} notifications for new appointment`);
    }

    // Schedule day-before reminder if appointment is in the future
    const appointmentDate = new Date(appointment.appointment_date + 'T00:00:00Z');
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    if (appointmentDate >= tomorrow) {
      const sendAt = calculateSendTime(
        appointment.appointment_date,
        appointment.appointment_time,
        'day_before'
      );

      // Check if we already have a scheduled notification for this appointment
      const { data: existing } = await supabase
        .from('scheduled_notifications')
        .select('id')
        .eq('event_id', appointment_id)
        .eq('timing_type', 'day_before')
        .eq('sent', false)
        .maybeSingle();

      if (existing) {
        // Update existing scheduled notification
        await supabase
          .from('scheduled_notifications')
          .update({
            send_at: sendAt,
            event_date: appointment.appointment_date,
            event_time: appointment.appointment_time,
            event_data: {
              title: `${personName} - ${appointment.appointment_type}`,
              content: addTimingContext(content, 'day_before'),
              divisionIds: divisionId ? [divisionId] : [],
              personName,
              personType
            }
          })
          .eq('id', existing.id);
        console.log("Updated existing day-before reminder");
      } else {
        // Create new scheduled notification
        await supabase.from('scheduled_notifications').insert({
          company_id: companyId,
          email_type: 'appointment',
          event_id: appointment_id,
          event_date: appointment.appointment_date,
          event_time: appointment.appointment_time,
          send_at: sendAt,
          timing_type: 'day_before',
          event_data: {
            title: `${personName} - ${appointment.appointment_type}`,
            content: addTimingContext(content, 'day_before'),
            divisionIds: divisionId ? [divisionId] : [],
            personName,
            personType
          }
        });
        console.log("Created day-before reminder scheduled for:", sendAt);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipientCount: recipients.length,
        scheduledReminder: appointmentDate >= tomorrow
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in send-appointment-notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
