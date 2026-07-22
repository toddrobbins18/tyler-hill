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

export function groupOutlookItemsByDate(items: PersonOutlookItem[]): PersonOutlookItem[][] {
  const byDate = new Map<string, PersonOutlookItem[]>();
  for (const item of items) {
    const bucket = byDate.get(item.date) ?? [];
    bucket.push(item);
    byDate.set(item.date, bucket);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, dayItems]) => dayItems);
}

export function outlookDayHeading(dateYmd: string, today = new Date()): string {
  const start = format(today, "yyyy-MM-dd");
  const tomorrow = format(addDays(today, 1), "yyyy-MM-dd");
  if (dateYmd === start) return "Today";
  if (dateYmd === tomorrow) return "Tomorrow";
  return formatOutlookDateDisplay(dateYmd);
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

export type SupervisorOutlookScope = {
  divisionIds: string[] | null;
  sportTypes: string[] | null;
  scopeLabel: string;
};

function sportTypeMatchesAssigned(
  sportType: string | null | undefined,
  assignedSports: string[],
): boolean {
  if (!assignedSports.length) return true;
  const normalized = (sportType || "").trim().toLowerCase();
  return assignedSports.some((sport) => {
    const assigned = sport.trim().toLowerCase();
    return normalized === assigned || normalized.includes(assigned) || assigned.includes(normalized);
  });
}

function eventDivisionIdsFromSportRow(
  divisions: Array<{ division_id: string }> | null | undefined,
): string[] {
  return (divisions || []).map((row) => row.division_id).filter(Boolean);
}

function eventMatchesDivisionScope(
  eventDivisionIds: string[],
  divisionIds: string[] | null,
): boolean {
  if (!divisionIds || divisionIds.length === 0) return true;
  if (eventDivisionIds.length === 0) return true;
  return eventDivisionIds.some((id) => divisionIds.includes(id));
}

async function fetchDivisionNames(
  client: SupabaseClient,
  divisionIds: string[],
): Promise<string[]> {
  if (divisionIds.length === 0) return [];
  const { data } = await client.from("divisions").select("name").in("id", divisionIds);
  return (data || []).map((row) => row.name).filter(Boolean) as string[];
}

export async function resolveSupervisorOutlookScope(
  client: SupabaseClient,
  params: {
    userId: string | null;
    userRole: string | null;
    companyId: string;
    divisionFilter: string[] | null;
  },
): Promise<SupervisorOutlookScope> {
  if (params.userRole === "division_leader" || params.userRole === "viewer") {
    const ids = params.divisionFilter ?? [];
    const names = await fetchDivisionNames(client, ids);
    return {
      divisionIds: ids,
      sportTypes: null,
      scopeLabel: names.length > 0 ? names.join(", ") : "Your divisions",
    };
  }

  if (params.userRole === "specialist" && params.userId) {
    const { data: sports } = await client
      .from("specialist_sport_assignments")
      .select("sport")
      .eq("user_id", params.userId)
      .eq("company_id", params.companyId);

    const sportTypes = (sports || []).map((row) => row.sport).filter(Boolean) as string[];
    if (sportTypes.length > 0) {
      return {
        divisionIds: null,
        sportTypes,
        scopeLabel: sportTypes.join(", "),
      };
    }
  }

  return {
    divisionIds: null,
    sportTypes: null,
    scopeLabel: "All campers",
  };
}

async function getSupervisedChildIds(
  client: SupabaseClient,
  params: {
    companyId: string;
    season?: string | null;
    divisionIds: string[] | null;
    sportTypes: string[] | null;
    windowStart: string;
    windowEnd: string;
  },
): Promise<Set<string> | null> {
  const { companyId, season, divisionIds, sportTypes, windowStart, windowEnd } = params;

  if (!divisionIds && !sportTypes) return null;

  const childIds = new Set<string>();

  if (divisionIds && divisionIds.length > 0) {
    let childrenQuery = client
      .from("children")
      .select("id")
      .eq("company_id", companyId)
      .in("division_id", divisionIds);

    if (season) {
      childrenQuery = childrenQuery.eq("season", season);
    }

    const { data: children } = await childrenQuery;
    for (const child of children || []) {
      childIds.add(child.id);
    }
    return childIds;
  }

  if (sportTypes && sportTypes.length > 0) {
    let sportsQuery = client
      .from("sports_calendar")
      .select("id, sport_type, season")
      .eq("company_id", companyId)
      .gte("event_date", windowStart)
      .lte("event_date", windowEnd);

    if (season) {
      sportsQuery = sportsQuery.eq("season", season);
    }

    const { data: sportsEvents } = await sportsQuery;
    const matchingEventIds = (sportsEvents || [])
      .filter((event) => sportTypeMatchesAssigned(event.sport_type, sportTypes))
      .map((event) => event.id);

    if (matchingEventIds.length === 0) return childIds;

    const { data: rosterRows } = await client
      .from("sports_event_roster")
      .select("child_id")
      .eq("company_id", companyId)
      .in("sports_event_id", matchingEventIds);

    for (const row of rosterRows || []) {
      if (row.child_id) childIds.add(row.child_id);
    }
  }

  return childIds;
}

export async function fetchSupervisorScheduleOutlook(
  client: SupabaseClient,
  params: {
    companyId: string;
    season?: string | null;
    divisionIds: string[] | null;
    sportTypes: string[] | null;
    windowStart?: string;
    windowEnd?: string;
  },
): Promise<PersonOutlookItem[]> {
  const { start, end } =
    params.windowStart && params.windowEnd
      ? { start: params.windowStart, end: params.windowEnd }
      : getPersonOutlookWindow();

  const items: PersonOutlookItem[] = [];
  const supervisedChildIds = await getSupervisedChildIds(client, {
    companyId: params.companyId,
    season: params.season,
    divisionIds: params.divisionIds,
    sportTypes: params.sportTypes,
    windowStart: start,
    windowEnd: end,
  });

  const hasChildScope = supervisedChildIds !== null;

  let sportsQuery = client
    .from("sports_calendar")
    .select(`
      id, title, sport_type, event_date, time, start_time_field, depart_time, location, team, opponent, season,
      sports_calendar_divisions (division_id)
    `)
    .eq("company_id", params.companyId)
    .gte("event_date", start)
    .lte("event_date", end);

  if (params.season) {
    sportsQuery = sportsQuery.eq("season", params.season);
  }

  const { data: sportsEvents } = await sportsQuery;

  for (const event of sportsEvents || []) {
    const eventDivisions = eventDivisionIdsFromSportRow(event.sports_calendar_divisions);
    const divisionOk = eventMatchesDivisionScope(eventDivisions, params.divisionIds);
    const sportOk = sportTypeMatchesAssigned(event.sport_type, params.sportTypes || []);

    if (params.sportTypes && params.sportTypes.length > 0) {
      if (!sportOk) continue;
    } else if (params.divisionIds && params.divisionIds.length > 0) {
      if (!divisionOk) continue;
    }

    items.push({
      id: `sport-${event.id}`,
      kind: "sport",
      title: event.title || "Sports Event",
      date: normalizeOutlookYmd(event.event_date)!,
      time: event.start_time_field || event.time || event.depart_time,
      location: event.location,
      meta:
        [event.sport_type, event.team, event.opponent ? `vs ${event.opponent}` : null]
          .filter(Boolean)
          .join(" • ") || null,
    });
  }

  let tripsQuery = client
    .from("trips")
    .select("id, name, destination, date, end_date, type, departure_time, season")
    .eq("company_id", params.companyId)
    .lte("date", end)
    .or(`end_date.gte.${start},end_date.is.null`);

  if (params.season) {
    tripsQuery = tripsQuery.eq("season", params.season);
  }

  const { data: trips } = await tripsQuery;
  let relevantTripIds: Set<string> | null = null;

  if (hasChildScope) {
    relevantTripIds = new Set<string>();
    if (supervisedChildIds.size > 0) {
      const { data: attendees } = await client
        .from("trip_attendees")
        .select("trip_id")
        .eq("company_id", params.companyId)
        .in("child_id", Array.from(supervisedChildIds));

      for (const row of attendees || []) {
        if (row.trip_id) relevantTripIds.add(row.trip_id);
      }
    }
  }

  for (const trip of trips || []) {
    if (!eventOverlapsOutlookWindow(trip.date, trip.end_date, start, end)) continue;
    if (relevantTripIds !== null && !relevantTripIds.has(trip.id)) continue;

    items.push({
      id: `trip-${trip.id}`,
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

  let supervisedDivisions: Set<string> | null = null;
  if (hasChildScope && supervisedChildIds.size > 0) {
    const { data: scopedChildren } = await client
      .from("children")
      .select("division_id")
      .eq("company_id", params.companyId)
      .in("id", Array.from(supervisedChildIds));
    supervisedDivisions = new Set(
      (scopedChildren || []).map((child) => child.division_id).filter(Boolean) as string[],
    );
  }

  for (const activity of activities || []) {
    if (!eventOverlapsOutlookWindow(activity.event_date, activity.end_date, start, end)) continue;

    const activityDivisions = activityDivisionIds(activity);
    if (params.divisionIds && params.divisionIds.length > 0) {
      if (!eventMatchesDivisionScope(activityDivisions, params.divisionIds)) continue;
    }

    if (params.sportTypes && params.sportTypes.length > 0 && hasChildScope) {
      if (!supervisedDivisions || supervisedDivisions.size === 0) continue;
      if (activityDivisions.length > 0) {
        const divisionMatch = activityDivisions.some((id) => supervisedDivisions!.has(id));
        if (!divisionMatch) continue;
      }
    }

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
