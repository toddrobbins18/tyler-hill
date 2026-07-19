import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailTypeWithFilters, sendEmailNotifications } from "../_shared/emailHelpers.ts";
import { calculateSendTime } from "../_shared/timingHelpers.ts";
import {
  buildSportsEventEmailHtml,
  SPORTS_EVENT_EMAIL_SELECT,
} from "../_shared/rosterEmailContent.ts";

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

    const { event_id, trip_id, action } = await req.json();
    console.log(`Processing event notification: event=${event_id}, trip=${trip_id}, action=${action}`);

    let subject = '';
    let content = '';
    let recipients: any[] = [];
    let companyId = '';
    let emailType = '';
    let sendTimings: string[] = ['on_create'];

    if (event_id) {
      // Get sports event details with divisions
      const { data: event, error: eventError } = await supabase
        .from('sports_calendar')
        .select(SPORTS_EVENT_EMAIL_SELECT)
        .eq('id', event_id)
        .single();

      if (eventError) {
        console.error('Error fetching event:', eventError);
        throw eventError;
      }

      companyId = event.company_id;

      // Determine home/away email type
      const isHome = event.home_away === 'home' || !event.home_away;
      emailType = isHome ? 'sports_event_home' : 'sports_event_away';

      // Get division IDs
      const divisionIds = event.sports_calendar_divisions
        ?.map((scd: any) => scd.division_id)
        .filter(Boolean) || [];

      // Get sport type (normalize custom sports)
      const sportType = event.sport_type === 'custom' 
        ? event.custom_sport_type 
        : event.sport_type;

      console.log(`Event: ${emailType}, Divisions: ${divisionIds.length}, Sport: ${sportType}`);

      // Check timing configuration
      const { data: config } = await supabase
        .from('automated_email_config')
        .select('send_timing, enabled')
        .eq('company_id', companyId)
        .eq('email_type', emailType)
        .maybeSingle();

      const sendTimings = config?.send_timing || ['on_create'];
      const shouldSendNow = sendTimings.includes(
        action === 'created' ? 'on_create' : 'on_update'
      );

      // Get recipients with BOTH division and sport filtering
      recipients = await getRecipientsForEmailTypeWithFilters(
        supabase,
        emailType,
        companyId,
        { divisionIds, sportType }
      );

      // Get trip details if associated
      let trip = null;
      if (trip_id) {
        const { data: tripData } = await supabase
          .from('trips')
          .select('*')
          .eq('id', trip_id)
          .single();
        trip = tripData;
      }

      const rosterHtml = buildSportsEventEmailHtml(event, trip);

      subject = action === 'created' 
        ? `New Sports Event: ${event.title}`
        : `Sports Event Updated: ${event.title}`;

      content = rosterHtml;

      // Queue scheduled notifications for future timings
      const futureTimings = sendTimings.filter((t: string) => 
        !['on_create', 'on_update'].includes(t)
      );

      if (futureTimings.length > 0 && event.event_date) {
        console.log(`Queueing ${futureTimings.length} scheduled notifications`);
        
        const eventData = {
          title: event.title,
          content: content,
          divisionIds: divisionIds,
          sportType: sportType
        };

        for (const timing of futureTimings) {
          const sendAt = calculateSendTime(event.event_date, event.time, timing);
          
          await supabase.from('scheduled_notifications').insert({
            company_id: companyId,
            email_type: emailType,
            event_id: event_id,
            event_date: event.event_date,
            event_time: event.time,
            send_at: sendAt,
            timing_type: timing,
            event_data: eventData
          });
        }
      }

    } else if (trip_id) {
      // Get trip details only
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select(`
          *,
          trip_attendees (
            child:children (
              name,
              allergies,
              division_id
            )
          )
        `)
        .eq('id', trip_id)
        .single();

      if (tripError) {
        console.error('Error fetching trip:', tripError);
        throw tripError;
      }

      companyId = trip.company_id;
      emailType = 'trip_update';

      // Check timing configuration
      const { data: config } = await supabase
        .from('automated_email_config')
        .select('send_timing, enabled')
        .eq('company_id', companyId)
        .eq('email_type', emailType)
        .maybeSingle();

      const sendTimings = config?.send_timing || ['on_create'];
      const shouldSendNow = sendTimings.includes(
        action === 'created' ? 'on_create' : 'on_update'
      );

      // Get division IDs from attendees
      const divisionIds: string[] = Array.from(
        new Set(
          trip.trip_attendees
            ?.map((a: any) => a.child?.division_id)
            .filter((id: any): id is string => typeof id === 'string') || []
        )
      );

      // Get recipients with division filtering
      recipients = await getRecipientsForEmailTypeWithFilters(
        supabase,
        emailType,
        companyId,
        { divisionIds }
      );

      // Build attendee list
      const attendees = trip.trip_attendees
        ?.map((a: any) => a.child?.name)
        .filter(Boolean)
        .join(', ') || 'No attendees yet';

      // Check for allergies
      const allergies = trip.trip_attendees
        ?.map((a: any) => a.child?.allergies)
        .filter(Boolean);
      
      const allergyWarning = allergies?.length 
        ? `\n\n⚠️ **ALLERGY ALERT:** ${allergies.length} child(ren) have allergies. Please review individual profiles.`
        : '';

      subject = action === 'created'
        ? `New Trip: ${trip.name}`
        : `Trip Updated: ${trip.name}`;

      content = `
**Trip:** ${trip.name}
**Type:** ${trip.type}
**Date:** ${new Date(trip.date).toLocaleDateString()}
**Destination:** ${trip.destination || 'N/A'}
**Departure:** ${trip.departure_time || 'TBD'}
**Return:** ${trip.return_time || 'TBD'}
**Transportation:** ${trip.transportation_type || 'TBD'}
**Driver:** ${trip.driver || 'TBD'}
**Chaperone:** ${trip.chaperone || 'TBD'}

**Attendees:**
${attendees}
${allergyWarning}

${trip.meal ? `**Meal:** ${trip.meal}` : ''}

Please review the complete trip details in the Transportation section.
      `.trim();

      // Queue scheduled notifications for future timings
      const futureTimings = sendTimings.filter((t: string) => 
        !['on_create', 'on_update'].includes(t)
      );

      if (futureTimings.length > 0 && trip.date) {
        console.log(`Queueing ${futureTimings.length} scheduled trip notifications`);
        
        const eventData = {
          title: trip.name,
          content: content,
          divisionIds: divisionIds
        };

        for (const timing of futureTimings) {
          const sendAt = calculateSendTime(trip.date, trip.departure_time, timing);
          
          await supabase.from('scheduled_notifications').insert({
            company_id: companyId,
            email_type: emailType,
            event_id: trip_id,
            event_date: trip.date,
            event_time: trip.departure_time,
            send_at: sendAt,
            timing_type: timing,
            event_data: eventData
          });
        }
      }
    }

    // Only send immediate notification if configured
    const shouldSendNow = event_id 
      ? (sendTimings.includes(action === 'created' ? 'on_create' : 'on_update'))
      : (sendTimings.includes(action === 'created' ? 'on_create' : 'on_update'));

    if (shouldSendNow) {
      if (!recipients.length) {
        console.log(`No recipients configured for ${emailType}`);
        return new Response(
          JSON.stringify({ message: 'No recipients configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Send immediate notifications
      await sendEmailNotifications(supabase, recipients, subject, content, companyId);
      console.log(`Sent immediate notifications to ${recipients.length} recipients`);
    } else {
      console.log(`Skipping immediate notification (not configured for ${action})`);
    }

    // Log notification
    await supabase.from('notification_logs').insert({
      event_type: emailType,
      event_id: event_id || null,
      trip_id: trip_id || null,
      recipient_count: recipients.length,
      notification_version: 1,
    });

    console.log(`Successfully sent event notifications to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients_notified: recipients.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-event-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
