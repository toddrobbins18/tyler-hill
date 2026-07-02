import type { SupabaseClient } from "@supabase/supabase-js";

export type FieldTripSyncInput = {
  title: string;
  event_date: string;
  end_date?: string | null;
  is_multi_day?: boolean | null;
  depart_from_camp?: string | null;
  location?: string | null;
  activity_type?: string | null;
  capacity?: number | null;
  chaperone?: string | null;
};

export type FieldTripSyncMatch = {
  field_trip_id: string;
  company_id: string;
  season: string;
  previous_title?: string;
  previous_date?: string;
};

/** Keep transportation trips aligned when a field trip / activity is edited. */
export async function syncLinkedTripsFromFieldTrip(
  supabase: SupabaseClient,
  match: FieldTripSyncMatch,
  event: FieldTripSyncInput,
) {
  const payload = {
    name: event.title,
    date: event.event_date,
    end_date: event.is_multi_day ? event.end_date || null : null,
    is_multi_day: event.is_multi_day || false,
    departure_time: event.depart_from_camp || null,
    destination: event.location || null,
    event_type: event.activity_type || null,
    capacity: event.capacity ?? null,
    chaperone: event.chaperone || null,
    field_trip_id: match.field_trip_id,
  };

  let query = supabase
    .from("trips")
    .update(payload)
    .eq("company_id", match.company_id)
    .eq("season", match.season)
    .eq("type", "field_trip");

  if (match.field_trip_id) {
    query = query.eq("field_trip_id", match.field_trip_id);
  } else if (match.previous_title && match.previous_date) {
    query = query.eq("name", match.previous_title).eq("date", match.previous_date);
  }

  return query;
}
