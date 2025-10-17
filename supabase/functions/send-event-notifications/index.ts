import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_id, trip_id, action } = await req.json();
    console.log(`Processing notification for event ${event_id}, trip ${trip_id}, action: ${action}`);

    // 1. Fetch event details with all related data
    const { data: event, error: eventError } = await supabase
      .from('sports_calendar')
      .select(`
        *,
        divisions:sports_calendar_divisions(division_id)
      `)
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventError);
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch trip details
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      console.error('Trip not found:', tripError);
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch roster with children details
    const { data: roster, error: rosterError } = await supabase
      .from('sports_event_roster')
      .select(`
        *,
        children:child_id (
          id,
          name,
          allergies,
          division_id,
          divisions:division_id (name)
        )
      `)
      .eq('event_id', event_id);

    const rosterChildren = roster?.map(r => r.children).filter(Boolean) || [];
    console.log(`Found ${rosterChildren.length} children on roster`);

    // 4. Get event divisions
    const eventDivisionIds = event.divisions?.map((d: any) => d.division_id) || [];
    const rosterDivisionIds = [...new Set(rosterChildren.map((c: any) => c.division_id))];
    const allDivisionIds = [...new Set([...eventDivisionIds, ...rosterDivisionIds])];

    console.log(`Event divisions: ${eventDivisionIds.length}, Roster divisions: ${rosterDivisionIds.length}`);

    // 5. Identify recipients based on HOME vs AWAY
    const isAway = event.home_away === 'away';
    const recipients = new Map<string, any>(); // Using Map to deduplicate by user_id

    // Get division leaders for relevant divisions
    const { data: divisionLeaderUsers } = await supabase
      .from('division_permissions')
      .select(`
        user_id,
        profiles:user_id (
          id,
          email,
          full_name
        ),
        user_roles!inner (role)
      `)
      .in('division_id', allDivisionIds)
      .eq('can_access', true)
      .eq('user_roles.role', 'division_leader');

    divisionLeaderUsers?.forEach((dl: any) => {
      if (dl.profiles) {
        recipients.set(dl.profiles.id, {
          ...dl.profiles,
          role: 'Division Leader'
        });
      }
    });

    // Get specialists
    const { data: specialists } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        profiles:user_id (
          id,
          email,
          full_name
        )
      `)
      .eq('role', 'specialist');

    specialists?.forEach((s: any) => {
      if (s.profiles) {
        recipients.set(s.profiles.id, {
          ...s.profiles,
          role: 'Specialist'
        });
      }
    });

    // For AWAY events only: add Health Center and Food Services staff
    if (isAway) {
      // Health Center staff
      const { data: healthStaff } = await supabase
        .from('staff')
        .select('email, name')
        .eq('department', 'Health Center')
        .eq('status', 'active');

      if (healthStaff) {
        const healthEmails = healthStaff.map(s => s.email).filter(Boolean);
        const { data: healthProfiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('email', healthEmails);

        healthProfiles?.forEach(p => {
          recipients.set(p.id, {
            ...p,
            role: 'Health Center'
          });
        });
      }

      // Food Services staff
      const { data: foodStaff } = await supabase
        .from('staff')
        .select('email, name')
        .eq('department', 'Food Services')
        .eq('status', 'active');

      if (foodStaff) {
        const foodEmails = foodStaff.map(s => s.email).filter(Boolean);
        const { data: foodProfiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('email', foodEmails);

        foodProfiles?.forEach(p => {
          recipients.set(p.id, {
            ...p,
            role: 'Food Services'
          });
        });
      }
    }

    console.log(`Total recipients: ${recipients.size}`);

    // 6. Check if this is an update notification
    const { data: existingLogs } = await supabase
      .from('notification_logs')
      .select('notification_version')
      .eq('event_id', event_id)
      .order('notification_version', { ascending: false })
      .limit(1);

    const version = existingLogs && existingLogs.length > 0 
      ? existingLogs[0].notification_version + 1 
      : 1;
    const isUpdate = version > 1;

    // 7. Build notification content
    const childrenWithAllergies = rosterChildren.filter((c: any) => c.allergies);
    const allergyWarning = childrenWithAllergies.length > 0 
      ? `\n\n⚠️ ALLERGY ALERT: ${childrenWithAllergies.length} children with allergies on roster`
      : '';

    const rosterList = rosterChildren.map((c: any) => {
      const allergyNote = c.allergies ? ` ⚠️ ALLERGIES: ${c.allergies}` : '';
      const divisionName = c.divisions?.name || 'Unknown Division';
      return `• ${c.name} (${divisionName})${allergyNote}`;
    }).join('\n');

    const mealInfo = trip.meal 
      ? `\nMeal: ${trip.meal}${trip.meal_notes ? `\nMeal Notes: ${trip.meal_notes}` : ''}`
      : '';

    const subject = `${isUpdate ? 'UPDATED: ' : ''}[${event.home_away?.toUpperCase() || 'EVENT'}] ${event.sport_type} - ${event.title}`;
    
    const content = `Event Details:
${isUpdate ? '⚠️ THIS IS AN UPDATED NOTIFICATION\n\n' : ''}Date: ${new Date(event.event_date).toLocaleDateString()}
Time: ${event.time || 'TBA'}
Location: ${event.location || 'TBA'}
${event.opponent ? `Opponent: ${event.opponent}` : ''}
Type: ${event.home_away?.toUpperCase() || 'TBA'}

Transportation:
Driver: ${trip.driver || 'TBA'}
Departure: ${trip.departure_time || 'TBA'}
Return: ${trip.return_time || 'TBA'}
${trip.chaperone ? `Chaperone: ${trip.chaperone}` : ''}${mealInfo}

Roster (${rosterChildren.length} children):
${rosterList || 'No children added yet'}${allergyWarning}

${childrenWithAllergies.length > 0 ? '\n⚠️ CHILDREN WITH ALLERGIES:\n' + childrenWithAllergies.map((c: any) => `• ${c.name}: ${c.allergies}`).join('\n') : ''}`;

    // 8. Insert individual messages for each recipient
    const messages = Array.from(recipients.values()).map(recipient => ({
      recipient_id: recipient.id,
      sender_id: null, // System message
      subject: subject,
      content: content,
      read: false,
    }));

    if (messages.length > 0) {
      const { error: messageError } = await supabase
        .from('messages')
        .insert(messages);

      if (messageError) {
        console.error('Error inserting messages:', messageError);
        throw messageError;
      }

      console.log(`Inserted ${messages.length} notifications`);
    }

    // 9. Log the notification
    const { error: logError } = await supabase
      .from('notification_logs')
      .insert({
        event_id: event_id,
        trip_id: trip_id,
        event_type: event.home_away || 'home',
        notification_version: version,
        recipient_count: recipients.size,
      });

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        recipients: recipients.size,
        version: version,
        isUpdate: isUpdate,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in send-event-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
