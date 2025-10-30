import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailType, sendEmailNotifications } from "../_shared/emailHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log(`Found ${missedMeds.length} missed medications`);

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
    const medsByChild = missedMeds.reduce((acc: any, med: any) => {
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
