import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCsvPersonId } from "./csvPersonIdResolve";
import { expandDivisionIdsForRosterFilter } from "./divisionFilterUtils";

type DivisionRow = { id: string; name?: string | null };

const PAGE_SIZE = 1000;
const PERSON_ID_BATCH_SIZE = 500;
const CHILD_ID_BATCH_SIZE = 100;

type RosterChild = {
  id: string;
  person_id: string | null;
  name: string;
  division_id: string | null;
};

type AwardRow = {
  id: string;
  child_id: string;
  company_id: string;
  season?: string | null;
  date: string;
  title: string;
  description?: string | null;
  category?: string | null;
};

export type AwardWithChild = AwardRow & {
  children?: {
    id: string;
    name?: string | null;
    division_id?: string | null;
    season?: string | null;
    person_id?: string | null;
  } | null;
};

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

/** Map child row id → normalized person_id (all seasons the caller can read via RLS). */
async function fetchChildPersonIdMap(
  supabase: SupabaseClient,
  companyId: string,
  personIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(personIds.filter(Boolean)));

  for (let i = 0; i < unique.length; i += PERSON_ID_BATCH_SIZE) {
    const batch = unique.slice(i, i + PERSON_ID_BATCH_SIZE);
    const { data, error } = await supabase
      .from("children")
      .select("id, person_id")
      .eq("company_id", companyId)
      .in("person_id", batch);

    if (error) throw error;
    (data || []).forEach((child: { id: string; person_id: string | null }) => {
      const personId = normalizeCsvPersonId(child.person_id);
      if (personId) map.set(child.id, personId);
    });
  }

  return map;
}

async function fetchAwardsForChildIds(
  supabase: SupabaseClient,
  companyId: string,
  childIds: string[],
): Promise<AwardRow[]> {
  const awards: AwardRow[] = [];

  for (let i = 0; i < childIds.length; i += CHILD_ID_BATCH_SIZE) {
    const batch = childIds.slice(i, i + CHILD_ID_BATCH_SIZE);
    const batchAwards = await fetchAllRows<AwardRow>(async (from, to) =>
      supabase
        .from("awards")
        .select("id, child_id, company_id, season, date, title, description, category")
        .eq("company_id", companyId)
        .in("child_id", batch)
        .order("date", { ascending: false })
        .range(from, to),
    );
    awards.push(...batchAwards);
  }

  awards.sort((a, b) => b.date.localeCompare(a.date));
  return awards;
}

/**
 * Load awards for the active season roster, including achievements stored against
 * prior-season child rows for the same person_id.
 *
 * When divisionFilter is an empty array, client-side division filtering is skipped
 * and RLS scopes results (same as the Roster page for division leaders).
 */
export async function fetchAwardsForSeason(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  divisionFilter: string[] | null,
  allDivisions: DivisionRow[] = [],
): Promise<AwardWithChild[]> {
  let effectiveDivisionFilter = divisionFilter;
  if (divisionFilter !== null && divisionFilter.length > 0 && allDivisions.length > 0) {
    effectiveDivisionFilter = expandDivisionIdsForRosterFilter(
      divisionFilter,
      allDivisions,
    );
  }

  const roster = await fetchAllRows<RosterChild>(async (from, to) => {
    let query = supabase
      .from("children")
      .select("id, person_id, name, division_id")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("id")
      .range(from, to);

    if (effectiveDivisionFilter !== null && effectiveDivisionFilter.length > 0) {
      query = query.in("division_id", effectiveDivisionFilter);
    }

    return query;
  });

  if (roster.length === 0) {
    return [];
  }

  const rosterPersonIds = roster
    .map((child) => normalizeCsvPersonId(child.person_id))
    .filter(Boolean);

  const childIdToPersonId = new Map<string, string>();
  roster.forEach((child) => {
    const personId = normalizeCsvPersonId(child.person_id);
    if (personId) childIdToPersonId.set(child.id, personId);
  });

  const awardChildIds = new Set(roster.map((child) => child.id));

  if (rosterPersonIds.length > 0) {
    const relatedPersonIds = await fetchChildPersonIdMap(
      supabase,
      companyId,
      rosterPersonIds,
    );
    relatedPersonIds.forEach((personId, childId) => {
      awardChildIds.add(childId);
      childIdToPersonId.set(childId, personId);
    });
  }

  if (awardChildIds.size === 0) {
    return [];
  }

  const awards = await fetchAwardsForChildIds(
    supabase,
    companyId,
    Array.from(awardChildIds),
  );

  const rosterByPersonId = new Map(
    roster
      .filter((child) => normalizeCsvPersonId(child.person_id))
      .map((child) => [normalizeCsvPersonId(child.person_id), child]),
  );
  const rosterById = new Map(roster.map((child) => [child.id, child]));

  return awards.map((award) => {
    const linkedPersonId = childIdToPersonId.get(award.child_id) || "";
    const currentRosterChild =
      (linkedPersonId && rosterByPersonId.get(linkedPersonId)) ||
      rosterById.get(award.child_id) ||
      null;

    return {
      ...award,
      children: currentRosterChild
        ? {
            id: currentRosterChild.id,
            name: currentRosterChild.name,
            division_id: currentRosterChild.division_id,
            season,
            person_id: linkedPersonId || null,
          }
        : null,
    };
  }).filter((award) => award.children != null) as AwardWithChild[];
}
