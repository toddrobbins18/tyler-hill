import type { SupabaseClient } from "@supabase/supabase-js";
import { camperEnrolledInWeek } from "@/lib/enrollmentWeekCalendar";
import { DAY_CAMP_ENROLLMENT_WEEKS } from "@/lib/enrolledWeeks";

export type AudienceKind = "group" | "bus";

export type AudienceCamper = {
  id: string;
  name: string;
  groupName: string;
  enrolledWeeks: number[] | null;
  session: string | null;
};

export type BusRoster = {
  id: string;
  label: string;
  camperNames: string[];
};

export function normalizeAudienceName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function campersForGroup(
  campers: AudienceCamper[],
  groupName: string,
  weeks: number[],
  everyone: boolean,
): AudienceCamper[] {
  const key = normalizeAudienceName(groupName);
  return campers.filter((camper) => {
    if (normalizeAudienceName(camper.groupName) !== key || !key) return false;
    if (everyone) return true;
    if (weeks.length === 0) return false;
    return weeks.some((week) => camperEnrolledInWeek(camper.enrolledWeeks, camper.session, week));
  });
}

export function campersForBus(
  campers: AudienceCamper[],
  busNames: string[],
  weeks: number[],
  everyone: boolean,
): AudienceCamper[] {
  const onBus = new Set(busNames.map(normalizeAudienceName).filter(Boolean));
  return campers.filter((camper) => {
    if (!onBus.has(normalizeAudienceName(camper.name))) return false;
    if (everyone) return true;
    if (weeks.length === 0) return false;
    return weeks.some((week) => camperEnrolledInWeek(camper.enrolledWeeks, camper.session, week));
  });
}

export function audienceWeekChoices(): number[] {
  return Array.from({ length: DAY_CAMP_ENROLLMENT_WEEKS }, (_, index) => index + 1);
}

type BoardStop = { name?: string; camperNames?: string[] };
type BoardMeta = { id?: number; name?: string; bus?: string };

export function busRostersFromBoard(data: unknown): BusRoster[] {
  if (!data || typeof data !== "object") return [];
  const board = data as { coreStops?: Record<string, BoardStop[]>; routeMeta?: BoardMeta[] };
  const meta = new Map<number, BoardMeta>();
  for (const row of board.routeMeta ?? []) {
    if (row?.id != null) meta.set(Number(row.id), row);
  }
  const rosters: BusRoster[] = [];
  for (const [routeId, stops] of Object.entries(board.coreStops ?? {})) {
    const id = Number(routeId);
    const route = meta.get(id);
    const names = new Set<string>();
    for (const stop of stops ?? []) {
      const listed = stop.camperNames?.length ? stop.camperNames : stop.name ? [stop.name] : [];
      for (const name of listed) {
        const trimmed = name.trim();
        if (trimmed && !/^camp$/i.test(trimmed)) names.add(trimmed);
      }
    }
    if (names.size === 0) continue;
    const bus = route?.bus?.trim();
    const routeName = route?.name?.trim();
    const label = [bus ? `Bus ${bus}` : `Route ${id}`, routeName].filter(Boolean).join(" · ");
    rosters.push({ id: String(id), label, camperNames: [...names].sort((a, b) => a.localeCompare(b)) });
  }
  return rosters.sort((a, b) => a.label.localeCompare(b.label));
}

export async function loadAudienceCampers(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<AudienceCamper[]> {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, group_name, enrolled_weeks, session, status")
    .eq("company_id", companyId)
    .eq("season", season);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => String(row.status ?? "active") !== "inactive")
    .map((row) => ({
      id: row.id,
      name: row.name,
      groupName: row.group_name?.trim() || "",
      enrolledWeeks: (row.enrolled_weeks as number[] | null) ?? null,
      session: row.session,
    }));
}

export async function loadBusRosters(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<BusRoster[]> {
  const { data, error } = await supabase
    .from("transport_boards")
    .select("data")
    .eq("company_id", companyId)
    .eq("season", season)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return busRostersFromBoard(data?.data);
}

export async function publishAudienceMessage(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    season: string;
    title: string;
    body: string;
    kind: AudienceKind;
    label: string;
    weeks: number[];
    everyone: boolean;
    childIds: string[];
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("publish_parent_audience_message", {
    _company_id: input.companyId,
    _season: input.season,
    _title: input.title,
    _body: input.body,
    _audience_kind: input.kind,
    _audience_label: input.label,
    _week_numbers: input.everyone ? null : input.weeks,
    _everyone: input.everyone,
    _child_ids: input.childIds,
  });
  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}
