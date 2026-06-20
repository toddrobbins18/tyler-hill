import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailTypeWithFilters, sendEmailNotifications } from "../_shared/emailHelpers.ts";
import { calculateSendTime } from "../_shared/timingHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_TYPE = 'sports_academy';

/** Legacy configs may still store day_before for Sports Academy — treat as 1 hour before. */
function normalizeSportsAcademyTiming(timing: string): string {
  return timing === 'day_before' ? '1_hour_before' : timing;
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

    const { enrollment_id, action } = await req.json();
    console.log(`Sports academy notification triggered: ${action} for enrollment ${enrollment_id}`);

    const { data: enrollment, error } = await supabase
      .from('sports_academy')
      .select(`
        *,
        children!inner(
          id, 
          name, 
          division_id,
          divisions(id, name)
        )
      `)
      .eq('id', enrollment_id)
      .single();

    if (error) {
      console.error('Error fetching sports academy enrollment:', error);
      throw error;
    }

    const divisionIds = enrollment.children?.division_id
      ? [enrollment.children.division_id]
      : [];

    const sportType = enrollment.sport_name;

    console.log(`Enrollment for ${enrollment.children?.name}, Division: ${enrollment.children?.divisions?.name}, Sport: ${sportType}`);

    const { data: config } = await supabase
      .from('automated_email_config')
      .select('send_timing, enabled')
      .eq('company_id', enrollment.company_id)
      .eq('email_type', EMAIL_TYPE)
      .maybeSingle();

    const sendTimings = config?.send_timing || ['on_create'];
    const actionKey = action === 'INSERT' ? 'on_create' : 'on_update';
    const shouldSendNow = sendTimings.includes(actionKey);

    const recipients = await getRecipientsForEmailTypeWithFilters(
      supabase,
      EMAIL_TYPE,
      enrollment.company_id,
      { divisionIds, sportType }
    );

    const actionText = action === 'INSERT' ? 'New' : 'Updated';
    const subject = `${actionText} Sports Academy Enrollment: ${sportType} - ${enrollment.children?.name}`;
    const content = `
      <h2>${subject}</h2>
      <p><strong>Camper:</strong> ${enrollment.children?.name}</p>
      <p><strong>Division:</strong> ${enrollment.children?.divisions?.name || 'N/A'}</p>
      <p><strong>Sport:</strong> ${sportType}</p>
      ${enrollment.instructor ? `<p><strong>Instructor:</strong> ${enrollment.instructor}</p>` : ''}
      ${enrollment.schedule_periods?.length ? `<p><strong>Schedule:</strong> ${enrollment.schedule_periods.join(', ')}</p>` : ''}
      ${enrollment.start_date ? `<p><strong>Start Date:</strong> ${enrollment.start_date}</p>` : ''}
      ${enrollment.end_date ? `<p><strong>End Date:</strong> ${enrollment.end_date}</p>` : ''}
      ${enrollment.notes ? `<p><strong>Notes:</strong> ${enrollment.notes}</p>` : ''}
      <p><em>This notification was sent to staff in the ${sportType} program and relevant division leaders.</em></p>
    `;

    let immediateRecipientCount = 0;

    if (shouldSendNow && recipients.length) {
      await sendEmailNotifications(supabase, recipients, subject, content, enrollment.company_id);
      immediateRecipientCount = recipients.length;
      console.log(`Sent immediate sports academy notification to ${recipients.length} recipients`);
    } else if (shouldSendNow) {
      console.log('No recipients configured for immediate sports_academy notification');
    } else {
      console.log(`Skipping immediate sports academy notification (not configured for ${actionKey})`);
    }

    const futureTimings = sendTimings
      .filter((timing: string) => !['on_create', 'on_update'].includes(timing))
      .map(normalizeSportsAcademyTiming);

    if (futureTimings.length > 0 && enrollment.start_date) {
      const eventData = {
        title: `${sportType} - ${enrollment.children?.name}`,
        content,
        divisionIds,
        sportType,
      };

      for (const timing of futureTimings) {
        const sendAt = calculateSendTime(enrollment.start_date, null, timing);

        await supabase.from('scheduled_notifications').insert({
          company_id: enrollment.company_id,
          email_type: EMAIL_TYPE,
          event_id: enrollment_id,
          event_date: enrollment.start_date,
          event_time: null,
          send_at: sendAt,
          timing_type: timing,
          event_data: eventData,
        });
      }

      console.log(`Queued ${futureTimings.length} scheduled sports academy notification(s)`);
    }

    await supabase.from('notification_logs').insert({
      event_type: EMAIL_TYPE,
      event_id: enrollment_id,
      recipient_count: immediateRecipientCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipientCount: immediateRecipientCount,
        scheduledCount: futureTimings.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-sports-academy-notification:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
