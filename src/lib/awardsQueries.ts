import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCsvPersonId } from "./csvPersonIdResolve";
import { expandDivisionIdsForRosterFilter } from "./divisionFilterUtils";

type DivisionRow = { id: string; name?: string | null };

const PAGE_SIZE = 1000;
const PERSON_ID_BATCH_SIZE = 500;
const CHILD_ID_BATCH_SIZE = 100;

export type AwardWithChild = {
  id: string;
  child_id: string;
  company_id: string;
  season?: string | null;
  date: string;
  title: string;
  description?: string | null;
  category?: string | null;
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

async function fetchChildIdsForPersonIds(
  supabase: SupabaseClient,
  companyId: string,
  personIds: string[],
): Promise<Set<string>> {
  const childIds = new Set<string>();
  const unique = Array.from(new Set(personIds.filter(Boolean)));

  for (let i = 0; i < unique.length; i += PERSON_ID_BATCH_SIZE) {
    const batch = unique.slice(i, i + PERSON_ID_BATCH_SIZE);
    const { data, error } = await supabase
      .from("children")
      .select("id")
      .eq("company_id", companyId)
      .in("person_id", batch);

    if (error) throw error;
    (data || []).forEach((child) => childIds.add(child.id));
  }

  return childIds;
}

async function fetchAwardsForChildIds(
  supabase: SupabaseClient,
  companyId: string,
  childIds: string[],
): Promise<AwardWithChild[]> {
  const awards: AwardWithChild[] = [];

  for (let i = 0; i < childIds.length; i += CHILD_ID_BATCH_SIZE) {
    const batch = childIds.slice(i, i + CHILD_ID_BATCH_SIZE);
    const batchAwards = await fetchAllRows<AwardWithChild>(async (from, to) =>
      supabase
        .from("awards")
        .select(`
          *,
          children:child_id (
            id,
            name,
            division_id,
            person_id
          )
        `)
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
 */
export async function fetchAwardsForSeason(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  divisionFilter: string[] | null,
  allDivisions: DivisionRow[] = [],
): Promise<AwardWithChild[]> {
  if (divisionFilter !== null && divisionFilter.length === 0) {
    return [];
  }

  let effectiveDivisionFilter = divisionFilter;
  if (divisionFilter !== null && divisionFilter.length > 0 && allDivisions.length > 0) {
    effectiveDivisionFilter = expandDivisionIdsForRosterFilter(
      divisionFilter,
      allDivisions,
    );
  }

  const roster = await fetchAllRows<{
    id: string;
    person_id: string | null;
    name: string;
    division_id: string | null;
  }>(async (from, to) => {
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
  const rosterChildIds = new Set(roster.map((child) => child.id));
  const rosterPersonIdSet = new Set(rosterPersonIds);

  const awardChildIds = new Set(roster.map((child) => child.id));

  if (rosterPersonIds.length > 0) {
    const relatedChildIds = await fetchChildIdsForPersonIds(
      supabase,
      companyId,
      rosterPersonIds,
    );
    relatedChildIds.forEach((id) => awardChildIds.add(id));
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

  let result = awards.map((award) => {
    const linked = award.children;
    const linkedPersonId = normalizeCsvPersonId(linked?.person_id);
    const currentRosterChild =
      (linkedPersonId && rosterByPersonId.get(linkedPersonId)) ||
      (linked?.id && rosterById.get(linked.id)) ||
      linked;

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
        : award.children,
    };
  }) as AwardWithChild[];

  if (divisionFilter !== null && divisionFilter.length > 0) {
    result = result.filter((award) => {
      const childId = award.children?.id;
      const personId = normalizeCsvPersonId(award.children?.person_id);
      if (childId && rosterChildIds.has(childId)) return true;
      if (personId && rosterPersonIdSet.has(personId)) return true;
      return false;
    });
  }

  return result;
}
