import { addDays, format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OutlookItemKind = "trip" | "sport" | "activity";

export type PersonOutlookItem = {
  id: string;
  kind: OutlookItemKind;
  title: string;
  date: string;
  endDate?: string | null;
  time?: string | null;
  location?: string | null;
  meta?: string | null;
};

export function getPersonOutlookWindow(today = new Date()): { start: string; end: string } {
  const start = format(today, "yyyy-MM-dd");
  const end = format(addDays(today, 2), "yyyy-MM-dd");
  return { start, end };
}

export function normalizeOutlookYmd(date: string | null | undefined): string | null {
  if (!date) return null;
  const trimmed = String(date).trim();
  if (!trimmed) return null;
  return trimmed.split("T")[0];
}

export function eventOverlapsOutlookWindow(
  eventStart: string | null | undefined,
  eventEnd: string | null | undefined,
  windowStart: string,
  windowEnd: string,
): boolean {
  const start = normalizeOutlookYmd(eventStart);
  if (!start) return false;
  const end = normalizeOutlookYmd(eventEnd) || start;
  return start <= windowEnd && end >= windowStart;
}

export function staffNameInAssignmentField(
  staffName: string,
  field: string | null | undefined,
): boolean {
  if (!staffName || !field) return false;
  const normalized = staffName.trim().toLowerCase();
  return field
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
    .some((name) => name === normalized);
}

function activityDivisionIds(activity: {
  division_id?: string | null;
  activities_field_trips_divisions?: Array<{ division_id: string }>;
}): string[] {
  const ids = new Set<string>();
  if (activity.division_id) ids.add(activity.division_id);
  (activity.activities_field_trips_divisions || []).forEach((row) => {
    if (row.division_id) ids.add(row.division_id);
  });
  return Array.from(ids);
}

export function activityMatchesChildDivision(
  activity: {
    division_id?: string | null;
    activities_field_trips_divisions?: Array<{ division_id: string }>;
  },
  childDivisionId: string | null | undefined,
): boolean {
  const divisionIds = activityDivisionIds(activity);
  if (divisionIds.length === 0) return true;
  if (!childDivisionId) return false;
  return divisionIds.includes(childDivisionId);
}

function sortOutlookItems(items: PersonOutlookItem[]): PersonOutlookItem[] {
  return [...items].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (a.time || "").localeCompare(b.time || "");
  });
}

export function formatOutlookDateDisplay(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function groupOutlookItemsByKind(items: PersonOutlookItem[]) {
  return {
    trips: items.filter((item) => item.kind === "trip"),
    sports: items.filter((item) => item.kind === "sport"),
    activities: items.filter((item) => item.kind === "activity"),
  };
}

export async function fetchChildScheduleOutlook(
  client: SupabaseClient,
  params: {
    childId: string;
    divisionId?: string | null;
    companyId: string;
    season?: string | null;
    windowStart?: string;
    windowEnd?: string;
  },
): Promise<PersonOutlookItem[]> {
  const { start, end } =
    params.windowStart && params.windowEnd
      ? { start: params.windowStart, end: params.windowEnd }
      : getPersonOutlookWindow();
  const items: PersonOutlookItem[] = [];

  const { data: sportsRoster } = await client
    .from("sports_event_roster")
    .select(`
      id,
      sports_calendar (
        id, title, sport_type, event_date, time, location, team, opponent, season
      )
    `)
    .eq("child_id", params.childId)
    .eq("company_id", params.companyId);

  for (const row of sportsRoster || []) {
    const event = row.sports_calendar as {
      title?: string | null;
      sport_type?: string | null;
      event_date?: string | null;
      time?: string | null;
      location?: string | null;
      team?: string | null;
      opponent?: string | null;
      season?: string | null;
    } | null;
    if (!event?.event_date) continue;
    if (params.season && event.season && event.season !== params.season) continue;
    if (!eventOverlapsOutlookWindow(event.event_date, null, start, end)) continue;
    items.push({
      id: `sport-${row.id}`,
      kind: "sport",
      title: event.title || "Sports Event",
      date: normalizeOutlookYmd(event.event_date)!,
      time: event.time,
      location: event.location,
      meta:
        [event.sport_type, event.team, event.opponent ? `vs ${event.opponent}` : null]
          .filter(Boolean)
          .join(" • ") || null,
    });
  }

  const { data: tripRows } = await client
    .from("trip_attendees")
    .select(`
      id,
      trips (
        id, name, destination, date, end_date, type, departure_time, return_time, season
      )
    `)
    .eq("child_id", params.childId)
    .eq("company_id", params.companyId);

  for (const row of tripRows || []) {
    const trip = row.trips as {
      name?: string | null;
      destination?: string | null;
      date?: string | null;
      end_date?: string | null;
      type?: string | null;
      departure_time?: string | null;
      season?: string | null;
    } | null;
    if (!trip?.date) continue;
    if (params.season && trip.season && trip.season !== params.season) continue;
    if (!eventOverlapsOutlookWindow(trip.date, trip.end_date, start, end)) continue;
    items.push({
      id: `trip-${row.id}`,
      kind: "trip",
      title: trip.name || trip.destination || "Trip",
      date: normalizeOutlookYmd(trip.date)!,
      endDate: normalizeOutlookYmd(trip.end_date),
      time: trip.departure_time,
      location: trip.destination,
      meta: trip.type || null,
    });
  }

  let activitiesQuery = client
    .from("activities_field_trips")
    .select(`
      id, title, activity_type, event_date, end_date, time, location, division_id, season,
      activities_field_trips_divisions (division_id)
    `)
    .eq("company_id", params.companyId)
    .lte("event_date", end)
    .or(`end_date.gte.${start},end_date.is.null`);

  if (params.season) {
    activitiesQuery = activitiesQuery.eq("season", params.season);
  }

  const { data: activities } = await activitiesQuery;
  for (const activity of activities || []) {
    if (!eventOverlapsOutlookWindow(activity.event_date, activity.end_date, start, end)) continue;
    if (!activityMatchesChildDivision(activity, params.divisionId)) continue;
    items.push({
      id: `activity-${activity.id}`,
      kind: "activity",
      title: activity.title || "Activity",
      date: normalizeOutlookYmd(activity.event_date)!,
      endDate: normalizeOutlookYmd(activity.end_date),
      time: activity.time,
      location: activity.location,
      meta: activity.activity_type || null,
    });
  }

  return sortOutlookItems(items);
}

export async function fetchStaffScheduleOutlook(
  client: SupabaseClient,
  params: {
    staffId: string;
    staffName: string;
    companyId: string;
    season?: string | null;
    windowStart?: string;
    windowEnd?: string;
  },
): Promise<PersonOutlookItem[]> {
  const { start, end } =
    params.windowStart && params.windowEnd
      ? { start: params.windowStart, end: params.windowEnd }
      : getPersonOutlookWindow();
  const items: PersonOutlookItem[] = [];

  const { data: sportsStaff } = await client
    .from("sports_event_staff")
    .select(`
      id,
      role,
      sports_calendar (
        id, title, sport_type, event_date, time, location, team, opponent, season
      )
    `)
    .eq("staff_id", params.staffId)
    .eq("company_id", params.companyId);

  for (const row of sportsStaff || []) {
    const event = row.sports_calendar as {
      title?: string | null;
      sport_type?: string | null;
      event_date?: string | null;
      time?: string | null;
      location?: string | null;
      team?: string | null;
      opponent?: string | null;
      season?: string | null;
    } | null;
    if (!event?.event_date) continue;
    if (params.season && event.season && event.season !== params.season) continue;
    if (!eventOverlapsOutlookWindow(event.event_date, null, start, end)) continue;
    items.push({
      id: `sport-${row.id}`,
      kind: "sport",
      title: event.title || "Sports Event",
      date: normalizeOutlookYmd(event.event_date)!,
      time: event.time,
      location: event.location,
      meta:
        [row.role, event.sport_type, event.team, event.opponent ? `vs ${event.opponent}` : null]
          .filter(Boolean)
          .join(" • ") || null,
    });
  }

  let tripsQuery = client
    .from("trips")
    .select("id, name, destination, date, end_date, type, departure_time, chaperone, driver, season")
    .eq("company_id", params.companyId)
    .lte("date", end)
    .or(`end_date.gte.${start},end_date.is.null`);

  if (params.season) {
    tripsQuery = tripsQuery.eq("season", params.season);
  }

  const { data: trips } = await tripsQuery;
  for (const trip of trips || []) {
    if (!eventOverlapsOutlookWindow(trip.date, trip.end_date, start, end)) continue;
    const isChaperone = staffNameInAssignmentField(params.staffName, trip.chaperone);
    const isDriver = staffNameInAssignmentField(params.staffName, trip.driver);
    if (!isChaperone && !isDriver) continue;
    items.push({
      id: `trip-${trip.id}`,
      kind: "trip",
      title: trip.name || trip.destination || "Trip",
      date: normalizeOutlookYmd(trip.date)!,
      endDate: normalizeOutlookYmd(trip.end_date),
      time: trip.departure_time,
      location: trip.destination,
      meta: [trip.type, isDriver ? "Driver" : null, isChaperone ? "Chaperone" : null]
        .filter(Boolean)
        .join(" • ") || null,
    });
  }

  let activitiesQuery = client
    .from("activities_field_trips")
    .select("id, title, activity_type, event_date, end_date, time, location, chaperone, season")
    .eq("company_id", params.companyId)
    .lte("event_date", end)
    .or(`end_date.gte.${start},end_date.is.null`);

  if (params.season) {
    activitiesQuery = activitiesQuery.eq("season", params.season);
  }

  const { data: activities } = await activitiesQuery;
  for (const activity of activities || []) {
    if (!eventOverlapsOutlookWindow(activity.event_date, activity.end_date, start, end)) continue;
    if (!staffNameInAssignmentField(params.staffName, activity.chaperone)) continue;
    items.push({
      id: `activity-${activity.id}`,
      kind: "activity",
      title: activity.title || "Activity",
      date: normalizeOutlookYmd(activity.event_date)!,
      endDate: normalizeOutlookYmd(activity.end_date),
      time: activity.time,
      location: activity.location,
      meta: activity.activity_type || "Chaperone",
    });
  }

  return sortOutlookItems(items);
}
