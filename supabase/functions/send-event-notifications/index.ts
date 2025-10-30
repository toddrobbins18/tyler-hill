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

    const { event_id, trip_id, action } = await req.json();
    console.log(`Processing event notification: event=${event_id}, trip=${trip_id}, action=${action}`);

    // Determine if this is a sports event update or trip update
    const emailType = event_id ? 'sports_event_update' : 'trip_update';

    // Get recipients based on configuration
    const recipients = await getRecipientsForEmailType(supabase, emailType);

    if (!recipients.length) {
      console.log(`No recipients configured for ${emailType}`);
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let subject = '';
    let content = '';

    if (event_id) {
      // Get sports event details
      const { data: event, error: eventError } = await supabase
        .from('sports_calendar')
        .select(`
          *,
          division:divisions (
            name
          ),
          sports_event_roster (
            child:children (
              name,
              allergies
            )
          )
        `)
        .eq('id', event_id)
        .single();

      if (eventError) {
        console.error('Error fetching event:', eventError);
        throw eventError;
      }

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

      // Build roster
      const roster = event.sports_event_roster
        ?.map((r: any) => r.child?.name)
        .filter(Boolean)
        .join(', ') || 'No roster yet';

      // Check for allergies
      const allergies = event.sports_event_roster
        ?.map((r: any) => r.child?.allergies)
        .filter(Boolean);
      
      const allergyWarning = allergies?.length 
        ? `\n\n⚠️ **ALLERGY ALERT:** ${allergies.length} child(ren) on roster have allergies. Please review individual profiles.`
        : '';

      subject = action === 'created' 
        ? `New Sports Event: ${event.title}`
        : `Sports Event Updated: ${event.title}`;

      content = `
**Event:** ${event.title}
**Sport:** ${event.sport_type}${event.custom_sport_type ? ` (${event.custom_sport_type})` : ''}
**Date:** ${new Date(event.event_date).toLocaleDateString()}
**Time:** ${event.time || 'TBD'}
**Location:** ${event.location || 'TBD'}
${event.home_away ? `**Home/Away:** ${event.home_away}` : ''}
${event.opponent ? `**Opponent:** ${event.opponent}` : ''}

**Roster:**
${roster}
${allergyWarning}

${trip ? `
**Transportation Details:**
- **Departure:** ${trip.departure_time || 'TBD'}
- **Return:** ${trip.return_time || 'TBD'}
- **Transportation:** ${trip.transportation_type || 'TBD'}
- **Driver:** ${trip.driver || 'TBD'}
` : ''}

${event.meal_options?.length ? `**Meal Options:** ${event.meal_options.join(', ')}` : ''}
${event.meal_notes ? `**Meal Notes:** ${event.meal_notes}` : ''}

Please review the complete event details in the Sports Calendar.
      `.trim();

    } else if (trip_id) {
      // Get trip details only
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select(`
          *,
          trip_attendees (
            child:children (
              name,
              allergies
            )
          )
        `)
        .eq('id', trip_id)
        .single();

      if (tripError) {
        console.error('Error fetching trip:', tripError);
        throw tripError;
      }

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
    }

    // Send notifications
    await sendEmailNotifications(supabase, recipients, subject, content);

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
