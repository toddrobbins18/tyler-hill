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
  child_id: string | null;
  staff_id: string | null;
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

type RosterStaff = {
  id: string;
  person_id: string | null;
  name: string;
  department: string | null;
  division_id: string | null;
};

export type AwardWithStaff = AwardRow & {
  staff?: {
    id: string;
    name?: string | null;
    department?: string | null;
    division_id?: string | null;
    season?: string | null;
    person_id?: string | null;
  } | null;
};

export type ReportingAwardRow = {
  date: string;
  recipientType: "Camper" | "Staff";
  name: string;
  division: string;
  department: string;
  title: string;
  category: string | null;
  description: string | null;
  divisionIds: (string | null | undefined)[];
  divisionNames: string[];
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
        .select("id, child_id, staff_id, company_id, season, date, title, description, category")
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

async function fetchStaffPersonIdMap(
  supabase: SupabaseClient,
  companyId: string,
  personIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(personIds.filter(Boolean)));

  for (let i = 0; i < unique.length; i += PERSON_ID_BATCH_SIZE) {
    const batch = unique.slice(i, i + PERSON_ID_BATCH_SIZE);
    const { data, error } = await supabase
      .from("staff")
      .select("id, person_id")
      .eq("company_id", companyId)
      .in("person_id", batch);

    if (error) throw error;
    (data || []).forEach((member: { id: string; person_id: string | null }) => {
      const personId = normalizeCsvPersonId(member.person_id);
      if (personId) map.set(member.id, personId);
    });
  }

  return map;
}

async function fetchAwardsForStaffIds(
  supabase: SupabaseClient,
  companyId: string,
  staffIds: string[],
): Promise<AwardRow[]> {
  const awards: AwardRow[] = [];

  for (let i = 0; i < staffIds.length; i += CHILD_ID_BATCH_SIZE) {
    const batch = staffIds.slice(i, i + CHILD_ID_BATCH_SIZE);
    const batchAwards = await fetchAllRows<AwardRow>(async (from, to) =>
      supabase
        .from("awards")
        .select("id, child_id, staff_id, company_id, season, date, title, description, category")
        .eq("company_id", companyId)
        .in("staff_id", batch)
        .order("date", { ascending: false })
        .range(from, to),
    );
    awards.push(...batchAwards);
  }

  awards.sort((a, b) => b.date.localeCompare(a.date));
  return awards;
}

/**
 * Load staff awards for the active season roster, including achievements stored against
 * prior-season staff rows for the same person_id.
 */
export async function fetchStaffAwardsForSeason(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<AwardWithStaff[]> {
  const roster = await fetchAllRows<RosterStaff>(async (from, to) =>
    supabase
      .from("staff")
      .select("id, person_id, name, department, division_id")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("id")
      .range(from, to),
  );

  if (roster.length === 0) {
    return [];
  }

  const rosterPersonIds = roster
    .map((member) => normalizeCsvPersonId(member.person_id))
    .filter(Boolean);

  const staffIdToPersonId = new Map<string, string>();
  roster.forEach((member) => {
    const personId = normalizeCsvPersonId(member.person_id);
    if (personId) staffIdToPersonId.set(member.id, personId);
  });

  const awardStaffIds = new Set(roster.map((member) => member.id));

  if (rosterPersonIds.length > 0) {
    const relatedPersonIds = await fetchStaffPersonIdMap(
      supabase,
      companyId,
      rosterPersonIds,
    );
    relatedPersonIds.forEach((personId, staffId) => {
      awardStaffIds.add(staffId);
      staffIdToPersonId.set(staffId, personId);
    });
  }

  const awards = await fetchAwardsForStaffIds(
    supabase,
    companyId,
    Array.from(awardStaffIds),
  );

  const rosterByPersonId = new Map(
    roster
      .filter((member) => normalizeCsvPersonId(member.person_id))
      .map((member) => [normalizeCsvPersonId(member.person_id), member]),
  );
  const rosterById = new Map(roster.map((member) => [member.id, member]));

  return awards
    .map((award) => {
      const linkedPersonId = staffIdToPersonId.get(award.staff_id!) || "";
      const currentRosterStaff =
        (linkedPersonId && rosterByPersonId.get(linkedPersonId)) ||
        rosterById.get(award.staff_id!) ||
        null;

      return {
        ...award,
        staff: currentRosterStaff
          ? {
              id: currentRosterStaff.id,
              name: currentRosterStaff.name,
              department: currentRosterStaff.department,
              division_id: currentRosterStaff.division_id,
              season,
              person_id: linkedPersonId || null,
            }
          : null,
      };
    })
    .filter((award) => award.staff != null) as AwardWithStaff[];
}

export async function fetchAwardsForReporting(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  divisionFilter: string[] | null,
  allDivisions: DivisionRow[] = [],
  divisionNameById: Map<string, string | null | undefined> = new Map(),
): Promise<ReportingAwardRow[]> {
  const [camperAwards, staffAwards] = await Promise.all([
    fetchAwardsForSeason(supabase, companyId, season, divisionFilter, allDivisions),
    fetchStaffAwardsForSeason(supabase, companyId, season),
  ]);

  const camperRows: ReportingAwardRow[] = camperAwards.map((award) => {
    const divisionName =
      (award.children?.division_id && divisionNameById.get(award.children.division_id)) ||
      "N/A";

    return {
      date: award.date,
      recipientType: "Camper" as const,
      name: award.children?.name || "Unknown",
      division: divisionName,
      department: "",
      title: award.title,
      category: award.category ?? null,
      description: award.description ?? null,
      divisionIds: [award.children?.division_id],
      divisionNames: [divisionName],
    };
  });

  const staffRows: ReportingAwardRow[] = staffAwards.map((award) => {
    const divisionName =
      (award.staff?.division_id && divisionNameById.get(award.staff.division_id)) ||
      "N/A";

    return {
      date: award.date,
      recipientType: "Staff" as const,
      name: award.staff?.name || "Unknown",
      division: divisionName,
      department: award.staff?.department || "",
      title: award.title,
      category: award.category ?? null,
      description: award.description ?? null,
      divisionIds: [award.staff?.division_id],
      divisionNames: [divisionName],
    };
  });

  return [...camperRows, ...staffRows].sort((a, b) => b.date.localeCompare(a.date));
}
