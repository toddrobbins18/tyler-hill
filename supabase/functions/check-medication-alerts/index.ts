import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailType, sendEmailNotifications } from "../_shared/emailHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Compare scheduled HH:mm to "now" in this timezone (camp-style Eastern wall clock). */
const MISSED_MED_TIMEZONE = "America/New_York";

function minutesSinceMidnightInTimezone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hour * 60 + minute;
}

function scheduledTimeToMinutes(scheduled: string | null | undefined): number | null {
  if (!scheduled || typeof scheduled !== "string") return null;
  const trimmed = scheduled.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function medicationAlertIsDue(now: Date, scheduledTime: string | null | undefined): boolean {
  const slotMin = scheduledTimeToMinutes(scheduledTime);
  if (slotMin === null) return true;
  const nowMin = minutesSinceMidnightInTimezone(now, MISSED_MED_TIMEZONE);
  return nowMin >= slotMin;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking for missed medications on ${today}`);

    // Get all medications scheduled for today that were not administered and haven't had alerts sent
    const { data: missedMeds, error: medsError } = await supabase
      .from('medication_logs')
      .select(`
        id,
        medication_name,
        dosage,
        scheduled_time,
        date,
        child:children (
          id,
          name,
          division:divisions (
            name
          ),
          leader:staff!children_leader_id_fkey (
            id,
            name,
            email
          )
        )
      `)
      .eq('date', today)
      .eq('administered', false)
      .eq('alert_sent', false);

    if (medsError) {
      console.error('Error fetching missed medications:', medsError);
      throw medsError;
    }

    if (!missedMeds || missedMeds.length === 0) {
      console.log('No missed medications found');
      return new Response(
        JSON.stringify({ message: 'No missed medications', alerts_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const now = new Date();
    const dueMeds = missedMeds.filter((med: any) => medicationAlertIsDue(now, med.scheduled_time));

    if (!dueMeds.length) {
      console.log(`Found ${missedMeds.length} pending meds; none past scheduled time yet (${MISSED_MED_TIMEZONE})`);
      return new Response(
        JSON.stringify({ message: 'No medications past scheduled time yet', alerts_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${dueMeds.length} missed medications past scheduled time (${missedMeds.length} pending total)`);

    // Get recipients based on configuration
    const recipients = await getRecipientsForEmailType(supabase, 'missed_medication');

    if (!recipients.length) {
      console.log('No recipients configured for missed medication alerts');
      return new Response(
        JSON.stringify({ message: 'No recipients configured', alerts_sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let alertsSent = 0;

    // Group medications by child for better notifications
    const medsByChild = dueMeds.reduce((acc: any, med: any) => {
      const childId = med.child?.id;
      if (!childId) return acc;
      
      if (!acc[childId]) {
        acc[childId] = {
          child: med.child,
          medications: []
        };
      }
      acc[childId].medications.push(med);
      return acc;
    }, {});

    // Send notifications for each child
    for (const [childId, data] of Object.entries(medsByChild) as any) {
      const { child, medications } = data;
      
      const medList = medications
        .map((m: any) => `- ${m.medication_name} (${m.dosage || 'N/A'}) at ${m.scheduled_time}`)
        .join('\n');

      const subject = `Missed Medication Alert: ${child.name}`;
      const content = `
**Child:** ${child.name}
**Division:** ${child.division?.name || 'N/A'}
**Date:** ${today}

**Missed Medications:**
${medList}

Please ensure these medications are administered as soon as possible.
      `.trim();

      // Send notification
      await sendEmailNotifications(supabase, recipients, subject, content);

      // Mark alerts as sent
      const medIds = medications.map((m: any) => m.id);
      await supabase
        .from('medication_logs')
        .update({ alert_sent: true })
        .in('id', medIds);

      alertsSent++;
    }

    console.log(`Successfully sent ${alertsSent} medication alerts to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_sent: alertsSent,
        recipients_notified: recipients.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in check-medication-alerts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
