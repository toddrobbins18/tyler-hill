/**
 * CampMinder Bunks API — North Shore day camp "groups" (Blue Jays, Cheetahs, etc.).
 * Docs: GET /bunks, /bunks/plans, /bunks/assignments @ api.campminder.com/bunks
 */

const CM_BUNKS_BASE = "https://api.campminder.com/bunks";

export type BunkRecord = {
  ID?: number;
  BunkID?: number;
  Name?: string;
  BunkName?: string;
  Code?: string;
  IsActive?: boolean;
  SortOrder?: number;
};

export type BunkPlanRecord = {
  ID?: number;
  Name?: string;
  Code?: string;
  IsActive?: boolean;
  BunkIDs?: number[];
};

export type BunkAssignmentRecord = {
  ID?: number;
  PersonID?: number;
  LastUpdatedUTC?: string;
  IsDeleted?: boolean;
};

export type BunkAssignmentsRow = {
  BunkPlanID?: number;
  BunkID?: number;
  Assignments?: BunkAssignmentRecord[];
};

export type BunkGroupLoadResult = {
  bunkNameByCmId: Map<number, string>;
  groupByPerson: Map<string, string>;
  bunkIdByPerson: Map<string, number>;
  stats: {
    bunksCount: number;
    bunkPlansCount: number;
    activePlansCount: number;
    assignmentPages: number;
    assignmentRows: number;
    personAssignments: number;
    deletedSkipped: number;
    bunkNamesSample: string[];
    planNamesSample: string[];
    errors: string[];
  };
};

type PaginatedResponse = {
  Results?: unknown[];
  TotalCount?: number;
  Next?: string | null;
};

function bunkIdFromRecord(bunk: BunkRecord): number | null {
  const id = bunk.ID ?? bunk.BunkID;
  return id != null ? Number(id) : null;
}

function bunkNameFromRecord(bunk: BunkRecord): string {
  const id = bunkIdFromRecord(bunk);
  return bunk.Name || bunk.BunkName || (id != null ? `Bunk ${id}` : "Unknown");
}

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean,
) {
  params.append(key, String(value));
}

function appendQueryArray(params: URLSearchParams, key: string, values: number[]) {
  for (const value of values) {
    params.append(key, String(value));
  }
}

async function fetchBunksPage(
  path: string,
  token: string,
  subscriptionKey: string,
  query: Record<string, string | number | boolean>,
  arrayParams: Record<string, number[]> = {},
  pageNumber: number,
  pageSize: number,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<PaginatedResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQuery(params, key, value);
  }
  for (const [key, values] of Object.entries(arrayParams)) {
    appendQueryArray(params, key, values);
  }
  appendQuery(params, "pagenumber", pageNumber);
  appendQuery(params, "pagesize", pageSize);

  const url = `${CM_BUNKS_BASE}${path}?${params.toString()}`;
  await acquireRateLimitSlot();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Bunks API ${path} HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Bunks API ${path} invalid JSON: ${text.slice(0, 200)}`);
  }
}

async function fetchAllBunksPages(
  path: string,
  token: string,
  subscriptionKey: string,
  query: Record<string, string | number | boolean>,
  arrayParams: Record<string, number[]> = {},
  acquireRateLimitSlot: () => Promise<void>,
  pageSize = 500,
): Promise<unknown[]> {
  const all: unknown[] = [];
  let pageNumber = 1;
  let effectivePageSize = pageSize;

  for (let guard = 0; guard < 200; guard++) {
    const data = await fetchBunksPage(
      path,
      token,
      subscriptionKey,
      query,
      arrayParams,
      pageNumber,
      effectivePageSize,
      acquireRateLimitSlot,
    );
    const items = Array.isArray(data.Results) ? data.Results : [];
    all.push(...items);

    if (pageNumber === 1 && items.length > 0 && items.length < effectivePageSize) {
      effectivePageSize = items.length;
    }

    const totalCount = Number(data.TotalCount ?? NaN);
    if (Number.isFinite(totalCount) && all.length >= totalCount) break;
    if (items.length < effectivePageSize) break;
    if (data.Next == null && items.length === 0) break;

    pageNumber++;
  }

  return all;
}

/** List bunks (groups) for a season — required query params per CampMinder docs. */
export async function fetchCampminderBunks(
  token: string,
  subscriptionKey: string,
  clientId: string,
  season: string,
  acquireRateLimitSlot: () => Promise<void>,
  includeInactive = false,
): Promise<BunkRecord[]> {
  const rows = await fetchAllBunksPages(
    "",
    token,
    subscriptionKey,
    {
      clientid: clientId,
      seasonid: season,
      orderascending: true,
      orderby: "SortOrder",
      includeinactive: includeInactive,
    },
    {},
    acquireRateLimitSlot,
  );
  return rows as BunkRecord[];
}

/** List bunk plans for a season. */
export async function fetchCampminderBunkPlans(
  token: string,
  subscriptionKey: string,
  clientId: string,
  season: string,
  acquireRateLimitSlot: () => Promise<void>,
  includeInactive = false,
): Promise<BunkPlanRecord[]> {
  const rows = await fetchAllBunksPages(
    "/plans",
    token,
    subscriptionKey,
    {
      clientid: clientId,
      seasonid: season,
      orderascending: true,
      orderby: "Name",
      includeinactive: includeInactive,
    },
    {},
    acquireRateLimitSlot,
  );
  return rows as BunkPlanRecord[];
}

/** List bunk assignments (PersonID → BunkID) for given plan + bunk ids. */
export async function fetchCampminderBunkAssignments(
  token: string,
  subscriptionKey: string,
  clientId: string,
  season: string,
  bunkPlanIds: number[],
  bunkIds: number[],
  acquireRateLimitSlot: () => Promise<void>,
): Promise<BunkAssignmentsRow[]> {
  if (!bunkPlanIds.length || !bunkIds.length) {
    return [];
  }

  const rows = await fetchAllBunksPages(
    "/assignments",
    token,
    subscriptionKey,
    {
      clientid: clientId,
      seasonid: season,
      includedeleted: false,
    },
    {
      bunkplanids: bunkPlanIds,
      bunkids: bunkIds,
    },
    acquireRateLimitSlot,
    200,
  );
  return rows as BunkAssignmentsRow[];
}

/**
 * Load day-camp group names from Bunks API (primary path per CampMinder support).
 * Merges bunk list + plans + assignments into person → group name maps.
 */
export async function loadDayCampGroupsFromBunksApi(
  token: string,
  subscriptionKey: string,
  clientId: string,
  season: string,
  acquireRateLimitSlot: () => Promise<void>,
  preloadedBunks?: BunkRecord[],
): Promise<BunkGroupLoadResult> {
  const stats = {
    bunksCount: 0,
    bunkPlansCount: 0,
    activePlansCount: 0,
    assignmentPages: 0,
    assignmentRows: 0,
    personAssignments: 0,
    deletedSkipped: 0,
    bunkNamesSample: [] as string[],
    planNamesSample: [] as string[],
    errors: [] as string[],
  };

  const bunkNameByCmId = new Map<number, string>();
  const groupByPerson = new Map<string, string>();
  const bunkIdByPerson = new Map<string, number>();

  let bunks: BunkRecord[] = preloadedBunks ?? [];
  let plans: BunkPlanRecord[] = [];

  try {
    if (!bunks.length) {
      bunks = await fetchCampminderBunks(
        token,
        subscriptionKey,
        clientId,
        season,
        acquireRateLimitSlot,
      );
    }
    stats.bunksCount = bunks.length;
    for (const bunk of bunks) {
      const id = bunkIdFromRecord(bunk);
      if (id == null) continue;
      bunkNameByCmId.set(id, bunkNameFromRecord(bunk));
    }
    stats.bunkNamesSample = [...bunkNameByCmId.values()].slice(0, 20);
    console.log(`[Bunks API] Listed ${bunks.length} bunks for season ${season}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`List bunks: ${msg}`);
    console.error(`[Bunks API] List bunks failed: ${msg}`);
  }

  try {
    plans = await fetchCampminderBunkPlans(
      token,
      subscriptionKey,
      clientId,
      season,
      acquireRateLimitSlot,
    );
    stats.bunkPlansCount = plans.length;
    stats.planNamesSample = plans
      .map((p) => p.Name || p.Code || String(p.ID ?? ""))
      .filter(Boolean)
      .slice(0, 20);
    console.log(`[Bunks API] Listed ${plans.length} bunk plans for season ${season}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`List plans: ${msg}`);
    console.error(`[Bunks API] List plans failed: ${msg}`);
  }

  const activePlans = plans.filter((p) => p.IsActive !== false);
  stats.activePlansCount = activePlans.length;

  const bunkIds = [...bunkNameByCmId.keys()];
  let planIds = activePlans
    .map((p) => Number(p.ID))
    .filter((id) => Number.isFinite(id) && id > 0);

  // Fall back to all plans if none marked active
  if (!planIds.length && plans.length) {
    planIds = plans
      .map((p) => Number(p.ID))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  if (!bunkIds.length) {
    stats.errors.push("No bunk IDs available for assignments call");
    return { bunkNameByCmId, groupByPerson, bunkIdByPerson, stats };
  }

  if (!planIds.length) {
    stats.errors.push("No bunk plan IDs available for assignments call");
    return { bunkNameByCmId, groupByPerson, bunkIdByPerson, stats };
  }

  try {
    const assignmentRows = await fetchCampminderBunkAssignments(
      token,
      subscriptionKey,
      clientId,
      season,
      planIds,
      bunkIds,
      acquireRateLimitSlot,
    );
    stats.assignmentRows = assignmentRows.length;
    console.log(`[Bunks API] Fetched ${assignmentRows.length} assignment row(s)`);

    for (const row of assignmentRows) {
      const bunkId = row.BunkID != null ? Number(row.BunkID) : null;
      const bunkName = bunkId != null ? bunkNameByCmId.get(bunkId) : undefined;
      if (!bunkId || !bunkName) continue;

      for (const assignment of row.Assignments ?? []) {
        if (assignment.IsDeleted) {
          stats.deletedSkipped++;
          continue;
        }
        const personId = assignment.PersonID != null ? String(assignment.PersonID) : "";
        if (!personId) continue;

        bunkIdByPerson.set(personId, bunkId);
        groupByPerson.set(personId, bunkName);
        stats.personAssignments++;
      }
    }

    console.log(
      `[Bunks API] Mapped ${groupByPerson.size} campers to bunk groups (${stats.deletedSkipped} deleted skipped)`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stats.errors.push(`List assignments: ${msg}`);
    console.error(`[Bunks API] Assignments failed: ${msg}`);
  }

  return { bunkNameByCmId, groupByPerson, bunkIdByPerson, stats };
}

/** Probe helper for test-campminder-bunks edge function. */
export async function probeCampminderBunks(
  token: string,
  subscriptionKey: string,
  clientId: string,
  season: string,
  personId?: string,
  acquireRateLimitSlot: () => Promise<void> = async () => {},
): Promise<Record<string, unknown>> {
  const loaded = await loadDayCampGroupsFromBunksApi(
    token,
    subscriptionKey,
    clientId,
    season,
    acquireRateLimitSlot,
  );

  const pid = personId ? String(personId) : null;
  const sampleGroups = [...loaded.groupByPerson.entries()].slice(0, 15).map(
    ([id, group]) => ({ personId: id, group }),
  );

  return {
    season,
    clientId,
    stats: loaded.stats,
    bunkNamesSample: loaded.stats.bunkNamesSample,
    planNamesSample: loaded.stats.planNamesSample,
    personGroupCount: loaded.groupByPerson.size,
    samplePersonGroups: sampleGroups,
    probePerson: pid
      ? {
        personId: pid,
        group: loaded.groupByPerson.get(pid) ?? null,
        bunkId: loaded.bunkIdByPerson.get(pid) ?? null,
      }
      : null,
  };
}
