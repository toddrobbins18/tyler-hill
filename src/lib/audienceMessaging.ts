import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_CAMP_ENROLLMENT_WEEKS, resolveEnrolledWeeks } from "@/lib/enrolledWeeks";

export type AudienceKind = "group" | "bus";
export type AudienceRosterKind = "group" | "division";

export type AudienceCamper = {
  id: string;
  name: string;
  groupName: string;
  divisionName: string;
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

/** Week chips should still include campers who have no enrollment weeks on file. */
export function matchesAudienceWeeks(
  camper: Pick<AudienceCamper, "enrolledWeeks" | "session">,
  weeks: number[],
  everyone: boolean,
): boolean {
  if (everyone) return true;
  if (weeks.length === 0) return false;
  const enrolled = resolveEnrolledWeeks(camper.enrolledWeeks, camper.session);
  if (enrolled.length === 0) return true;
  return weeks.some((week) => enrolled.includes(week));
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
    return matchesAudienceWeeks(camper, weeks, everyone);
  });
}

export function campersForDivision(
  campers: AudienceCamper[],
  divisionName: string,
  weeks: number[],
  everyone: boolean,
): AudienceCamper[] {
  const key = normalizeAudienceName(divisionName);
  return campers.filter((camper) => {
    if (normalizeAudienceName(camper.divisionName) !== key || !key) return false;
    return matchesAudienceWeeks(camper, weeks, everyone);
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
    return matchesAudienceWeeks(camper, weeks, everyone);
  });
}

export function audienceDivisionNames(campers: AudienceCamper[]): string[] {
  const names = new Set<string>();
  for (const camper of campers) {
    if (camper.divisionName) names.add(camper.divisionName);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function audienceGroupNames(campers: AudienceCamper[]): string[] {
  const names = new Set<string>();
  for (const camper of campers) {
    if (camper.groupName && camper.groupName !== "Unassigned") names.add(camper.groupName);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
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
    .select("id, name, group_name, enrolled_weeks, session, status, division_id, divisions(name)")
    .eq("company_id", companyId)
    .eq("season", season);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => String(row.status ?? "active") !== "inactive")
    .map((row) => {
      const division = row.divisions as { name?: string | null } | { name?: string | null }[] | null;
      const divisionRow = Array.isArray(division) ? division[0] : division;
      return {
        id: row.id,
        name: row.name,
        groupName: row.group_name?.trim() || "",
        divisionName: divisionRow?.name?.trim() || "",
        enrolledWeeks: (row.enrolled_weeks as number[] | null) ?? null,
        session: row.session,
      };
    });
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
