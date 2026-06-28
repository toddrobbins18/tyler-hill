import type { SupabaseClient } from "@supabase/supabase-js";

export type SportsEventTripSyncInput = {
  title: string;
  event_date: string;
  depart_time?: string | null;
  location?: string | null;
  sport_type?: string | null;
  custom_sport_type?: string | null;
};

/** Keep transportation trips aligned when a linked sports calendar event is edited. */
export async function syncLinkedTripsFromSportsEvent(
  supabase: SupabaseClient,
  sportsEventId: string,
  event: SportsEventTripSyncInput,
) {
  const eventType =
    event.sport_type === "Other" ? event.custom_sport_type : event.sport_type;

  const payload: Record<string, string | null> = {
    name: event.title,
    date: event.event_date,
    departure_time: event.depart_time || null,
    destination: event.location || null,
  };

  if (eventType) {
    payload.event_type = eventType;
  }

  return supabase.from("trips").update(payload).eq("sports_event_id", sportsEventId);
}
