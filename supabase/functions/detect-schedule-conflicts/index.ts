import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConflictCheckRequest {
  entityType: 'child' | 'staff';
  entityId: string;
  eventType: string;
  eventId: string;
  eventDate: string;
  eventTime?: string;
  companyId: string;
}

interface Conflict {
  conflict_type: string;
  event1_type: string;
  event1_id: string;
  event1_name: string;
  event1_date: string;
  event1_time?: string;
  event2_type: string;
  event2_id: string;
  event2_name: string;
  event2_date: string;
  event2_time?: string;
  entity_name: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { entityType, entityId, eventType, eventId, eventDate, eventTime, companyId }: ConflictCheckRequest = await req.json();

    console.log('Checking conflicts for:', { entityType, entityId, eventType, eventDate, eventTime });

    const conflicts: Conflict[] = [];
    let entityName = '';

    // Get entity name
    if (entityType === 'child') {
      const { data: child } = await supabaseClient
        .from('children')
        .select('name')
        .eq('id', entityId)
        .single();
      entityName = child?.name || 'Unknown Child';
    } else {
      const { data: staff } = await supabaseClient
        .from('staff')
        .select('name')
        .eq('id', entityId)
        .single();
      entityName = staff?.name || 'Unknown Staff';
    }

    // Check sports events
    if (entityType === 'child') {
      const { data: sportsRoster } = await supabaseClient
        .from('sports_event_roster')
        .select(`
          event_id,
          sports_calendar (
            id, title, event_date, time, sport_type
          )
        `)
        .eq('child_id', entityId)
        .eq('company_id', companyId);

      if (sportsRoster) {
        for (const roster of sportsRoster) {
          const event = roster.sports_calendar as any;
          if (event && event.event_date === eventDate && event.id !== eventId) {
            conflicts.push({
              conflict_type: 'same_day_conflict',
              event1_type: eventType,
              event1_id: eventId,
              event1_name: '', // Will be filled by caller
              event1_date: eventDate,
              event1_time: eventTime,
              event2_type: 'Sports Event',
              event2_id: event.id,
              event2_name: event.title,
              event2_date: event.event_date,
              event2_time: event.time,
              entity_name: entityName,
            });
          }
        }
      }
    }

    // Check trips
    if (entityType === 'child') {
      const { data: tripAttendees } = await supabaseClient
        .from('trip_attendees')
        .select(`
          trip_id,
          trips (
            id, name, date, departure_time, return_time
          )
        `)
        .eq('child_id', entityId)
        .eq('company_id', companyId);

      if (tripAttendees) {
        for (const attendee of tripAttendees) {
          const trip = attendee.trips as any;
          if (trip && trip.date === eventDate && trip.id !== eventId) {
            conflicts.push({
              conflict_type: 'same_day_conflict',
              event1_type: eventType,
              event1_id: eventId,
              event1_name: '',
              event1_date: eventDate,
              event1_time: eventTime,
              event2_type: 'Trip',
              event2_id: trip.id,
              event2_name: trip.name,
              event2_date: trip.date,
              event2_time: trip.departure_time,
              entity_name: entityName,
            });
          }
        }
      }
    }

    // Check tutoring/therapy schedules
    if (entityType === 'child') {
      const { data: tutoring } = await supabaseClient
        .from('tutoring_therapy')
        .select('*')
        .eq('child_id', entityId)
        .eq('company_id', companyId)
        .lte('start_date', eventDate)
        .or(`end_date.is.null,end_date.gte.${eventDate}`);

      if (tutoring && tutoring.length > 0) {
        for (const session of tutoring) {
          conflicts.push({
            conflict_type: 'recurring_conflict',
            event1_type: eventType,
            event1_id: eventId,
            event1_name: '',
            event1_date: eventDate,
            event1_time: eventTime,
            event2_type: 'Tutoring/Therapy',
            event2_id: session.id,
            event2_name: session.service_type,
            event2_date: eventDate,
            event2_time: session.schedule_periods?.[0] || 'Multiple times',
            entity_name: entityName,
          });
        }
      }
    }

    // Check sports academy
    if (entityType === 'child') {
      const { data: academy } = await supabaseClient
        .from('sports_academy')
        .select('*')
        .eq('child_id', entityId)
        .eq('company_id', companyId)
        .lte('start_date', eventDate)
        .or(`end_date.is.null,end_date.gte.${eventDate}`);

      if (academy && academy.length > 0) {
        for (const enrollment of academy) {
          conflicts.push({
            conflict_type: 'recurring_conflict',
            event1_type: eventType,
            event1_id: eventId,
            event1_name: '',
            event1_date: eventDate,
            event1_time: eventTime,
            event2_type: 'Sports Academy',
            event2_id: enrollment.id,
            event2_name: enrollment.sport_name,
            event2_date: eventDate,
            event2_time: enrollment.schedule_periods?.[0] || 'Multiple times',
            entity_name: entityName,
          });
        }
      }
    }

    // Check staff assignments to sports events
    if (entityType === 'staff') {
      const { data: staffEvents } = await supabaseClient
        .from('sports_event_staff')
        .select(`
          event_id,
          role,
          sports_calendar (
            id, title, event_date, time
          )
        `)
        .eq('staff_id', entityId)
        .eq('company_id', companyId);

      if (staffEvents) {
        for (const assignment of staffEvents) {
          const event = assignment.sports_calendar as any;
          if (event && event.event_date === eventDate && event.id !== eventId) {
            conflicts.push({
              conflict_type: 'same_day_conflict',
              event1_type: eventType,
              event1_id: eventId,
              event1_name: '',
              event1_date: eventDate,
              event1_time: eventTime,
              event2_type: `Sports Event (${assignment.role})`,
              event2_id: event.id,
              event2_name: event.title,
              event2_date: event.event_date,
              event2_time: event.time,
              entity_name: entityName,
            });
          }
        }
      }
    }

    console.log(`Found ${conflicts.length} conflicts`);

    return new Response(
      JSON.stringify({ conflicts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking conflicts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, conflicts: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
