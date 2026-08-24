/**
 * CampMinder camper custom fields (e.g. North Shore age group + FULLSUMMERGROUP).
 */

const CM_CUSTOM_FIELD_API_BASES = [
  "https://api.campminder.com/entity/customfield",
  "https://webapi.campminder.com/api/entity/customfield",
];

/** Individual summer group (sortable on Camper roster). */
export const FULL_SUMMER_GROUP_FIELD_NAMES = [
  "fullsummergroup",
  "full summer group",
];

/** Age group → Nest division for day camps. */
export const AGE_GROUP_FIELD_NAMES = [
  "age group",
  "agegroup",
  "age_group",
  "age groups",
];

export type DayCampCustomFieldMaps = {
  fullSummerGroupByPerson: Map<string, string>;
  ageGroupByPerson: Map<string, string>;
  matchedFields: { fullSummerGroup?: string; ageGroup?: string };
  debug: {
    fieldDefCount: number;
    fieldDefSample: string[];
    groupCandidateFields?: string[];
    ageGroupCandidates?: string[];
    apiBaseUsed?: string;
    dataFetchErrors: string[];
    firstBatchContainerCount?: number;
  };
};

type FieldDef = {
  ID?: number;
  Name?: string;
  IsActive?: boolean;
  EntityType?: number;
  Options?: unknown[];
};

/** Known North Shore sunshine group values — used to identify FULLSUMMERGROUP field defs. */
const KNOWN_SUMMER_GROUP_LABELS = [
  "bunnies",
  "ducklings",
  "giraffes",
  "koalas",
  "pandas",
];

const AGE_GROUP_DEF_EXCLUDE =
  /first choice|second choice|third choice|pick up|pickup|waiver|late night|overnight|signature|adventure|broadway/i;

type DataFieldAssignment = {
  FieldID?: number;
  SeasonID?: number;
  Updated?: string;
  Value?: unknown;
};

type EntityFieldContainer = {
  EID?: number;
  ObjectID?: number;
  EntityType?: number;
  EntityTypeID?: number;
  Data?: DataFieldAssignment[];
};

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, "");
}

function fieldNameMatches(name: string, candidates: string[]): boolean {
  const normalized = normalizeFieldName(name);
  return candidates.some((c) => normalizeFieldName(c) === normalized);
}

function fieldNameMatchesLoose(name: string, needles: string[]): boolean {
  const normalized = normalizeFieldName(name);
  return needles.some((needle) => normalized.includes(normalizeFieldName(needle)));
}

export function extractFieldFromRecord(
  record: Record<string, unknown> | null | undefined,
  candidates: string[],
): string | null {
  if (!record || typeof record !== "object") return null;

  for (const [key, raw] of Object.entries(record)) {
    if (!fieldNameMatches(key, candidates) && !fieldNameMatchesLoose(key, candidates)) continue;
    if (raw == null) continue;
    if (typeof raw === "object" && raw !== null && "Value" in (raw as object)) {
      const nested = (raw as { Value?: unknown }).Value;
      if (nested != null && String(nested).trim() !== "") return String(nested).trim();
    }
    if (String(raw).trim() !== "") return String(raw).trim();
  }

  const customFields = (record as { CustomFields?: unknown[] }).CustomFields;
  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      if (!field || typeof field !== "object") continue;
      const name = String((field as { Name?: string; FieldName?: string }).Name ??
        (field as { FieldName?: string }).FieldName ?? "");
      if (!name) continue;
      if (!fieldNameMatches(name, candidates) && !fieldNameMatchesLoose(name, candidates)) continue;
      const value = (field as { Value?: unknown }).Value;
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
  }

  return null;
}

/** Scan session attendee rows for FULLSUMMERGROUP / Age Group before API custom-field fetch. */
export function buildMapsFromSessionAttendees(
  attendees: Record<string, unknown>[],
): Pick<DayCampCustomFieldMaps, "fullSummerGroupByPerson" | "ageGroupByPerson"> {
  const fullSummerGroupByPerson = new Map<string, string>();
  const ageGroupByPerson = new Map<string, string>();

  for (const attendee of attendees) {
    const personId = attendee?.PersonID != null ? String(attendee.PersonID) : "";
    if (!personId) continue;

    const group = extractFieldFromRecord(attendee, FULL_SUMMER_GROUP_FIELD_NAMES);
    if (group) fullSummerGroupByPerson.set(personId, group);

    const ageGroup = extractFieldFromRecord(attendee, AGE_GROUP_FIELD_NAMES);
    if (ageGroup) ageGroupByPerson.set(personId, ageGroup);
  }

  return { fullSummerGroupByPerson, ageGroupByPerson };
}

function extractApiResult(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const candidates = [payload.Result, payload.Results, payload.data, payload.items];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function pickFieldValue(entries: DataFieldAssignment[], fieldId: number): string | null {
  const targetId = Number(fieldId);
  const rows = entries.filter(
    (e) =>
      Number(e.FieldID) === targetId &&
      e.Value != null &&
      String(e.Value).trim() !== "",
  );
  if (!rows.length) return null;

  const sorted = [...rows].sort(
    (a, b) => new Date(b.Updated || 0).getTime() - new Date(a.Updated || 0).getTime(),
  );
  return sorted[0]?.Value != null ? String(sorted[0].Value).trim() : null;
}

function defHasKnownSummerGroupOptions(def: FieldDef): boolean {
  if (!Array.isArray(def.Options) || def.Options.length === 0) return false;
  const normalized = def.Options.map((o) => String(o).toLowerCase().trim());
  return KNOWN_SUMMER_GROUP_LABELS.some((label) => normalized.includes(label));
}

function scoreFullSummerGroupDef(def: FieldDef): number {
  if (def.IsActive === false || !def.Name?.trim()) return -1;
  const normalized = normalizeFieldName(def.Name);

  if (normalized === "fullsummergroup") return 100;
  if (defHasKnownSummerGroupOptions(def)) return 95;
  if (normalized.includes("fullsummer") && normalized.includes("group")) return 90;
  if (/full.*summer.*group/i.test(def.Name)) return 85;
  if (normalized.includes("fullsummer")) return 70;
  if (normalized === "summergroup") return 60;
  if (normalized.endsWith("group") && /summer|full/i.test(def.Name)) return 50;

  return -1;
}

function scoreAgeGroupDef(def: FieldDef): number {
  if (def.IsActive === false || !def.Name?.trim()) return -1;
  if (AGE_GROUP_DEF_EXCLUDE.test(def.Name)) return -1;

  const normalized = normalizeFieldName(def.Name);
  if (normalized === "agegroup") return 100;
  if (/^age group$/i.test(def.Name.trim())) return 95;
  if (normalized === "agegroups" && !def.Name.includes("-")) return 80;
  if (normalized.startsWith("agegroup") && !def.Name.includes("-")) return 60;
  if (fieldNameMatchesLoose(def.Name, ["agegroup"]) && !def.Name.includes("-")) return 40;

  return -1;
}

function pickBestFieldDef(
  defs: FieldDef[],
  scorer: (def: FieldDef) => number,
): FieldDef | undefined {
  let best: FieldDef | undefined;
  let bestScore = -1;

  for (const def of defs) {
    const score = scorer(def);
    if (score > bestScore) {
      bestScore = score;
      best = def;
    }
  }

  return bestScore >= 0 ? best : undefined;
}

function resolvePersonIdFromContainer(
  container: EntityFieldContainer,
  requestedIds: Set<string>,
): string | null {
  const candidates = [
    container.EntityTypeID,
    container.ObjectID,
    container.EID,
  ]
    .filter((v) => v != null)
    .map((v) => String(v));

  for (const id of candidates) {
    if (requestedIds.has(id)) return id;
  }
  return candidates[0] ?? null;
}

async function fetchCmCustomFieldJson(
  path: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  query: Record<string, string | number | string[]>,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<{ payload: any; baseUsed: string } | null> {
  for (const base of CM_CUSTOM_FIELD_API_BASES) {
    await acquireRateLimitSlot();

    const params = new URLSearchParams();
    params.set("clientid", clientId);
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v));
      } else {
        params.set(key, String(value));
      }
    }

    const url = `${base}/${path}?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(
        `[Custom Fields] ${url} → HTTP ${response.status}: ${text.slice(0, 160)}`,
      );
      continue;
    }

    const payload = await response.json();
    if (payload?.Success === false) {
      console.warn(
        `[Custom Fields] ${url} → Success=false: ${payload?.ErrorText || "unknown error"}`,
      );
      continue;
    }

    return { payload, baseUsed: base };
  }

  return null;
}

function findFieldDefs(defs: FieldDef[]): {
  fullSummerDef?: FieldDef;
  ageGroupDef?: FieldDef;
} {
  let fullSummerDef = pickBestFieldDef(defs, scoreFullSummerGroupDef);
  if (!fullSummerDef) {
    fullSummerDef = defs.find(
      (d) => d.IsActive !== false && d.Name && fieldNameMatches(d.Name, FULL_SUMMER_GROUP_FIELD_NAMES),
    );
  }

  let ageGroupDef = pickBestFieldDef(defs, scoreAgeGroupDef);
  if (!ageGroupDef) {
    ageGroupDef = defs.find(
      (d) => d.IsActive !== false && d.Name && fieldNameMatches(d.Name, AGE_GROUP_FIELD_NAMES),
    );
  }

  return { fullSummerDef, ageGroupDef };
}

async function fetchCustomFieldDefs(
  token: string,
  subscriptionKey: string,
  clientId: string,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<{ defs: FieldDef[]; baseUsed?: string }> {
  const response = await fetchCmCustomFieldJson(
    "GetFieldDefs",
    token,
    subscriptionKey,
    clientId,
    {},
    acquireRateLimitSlot,
  );
  if (!response) return { defs: [] };
  return { defs: extractApiResult(response.payload) as FieldDef[], baseUsed: response.baseUsed };
}

async function fetchCustomFieldDataBatch(
  personIds: number[],
  fieldIds: number[],
  token: string,
  subscriptionKey: string,
  clientId: string,
  acquireRateLimitSlot: () => Promise<void>,
  preferredBase?: string,
): Promise<EntityFieldContainer[]> {
  const bases = preferredBase
    ? [preferredBase, ...CM_CUSTOM_FIELD_API_BASES.filter((b) => b !== preferredBase)]
    : CM_CUSTOM_FIELD_API_BASES;

  for (const base of bases) {
    await acquireRateLimitSlot();
    const params = new URLSearchParams();
    params.set("clientid", clientId);
    for (const id of personIds) params.append("PersonIDs", String(id));
    for (const id of fieldIds) params.append("FieldIDs", String(id));

    const url = `${base}/GetCustomFieldData?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(
        `[Custom Fields] GetCustomFieldData HTTP ${response.status}: ${text.slice(0, 160)}`,
      );
      continue;
    }

    const payload = await response.json();
    if (payload?.Success === false) {
      console.warn(
        `[Custom Fields] GetCustomFieldData Success=false: ${payload?.ErrorText || "unknown error"}`,
      );
      continue;
    }

    const containers = extractApiResult(payload) as EntityFieldContainer[];
    if (containers.length > 0) return containers;
  }

  return [];
}

export async function loadDayCampCamperCustomFields(
  personIds: string[],
  season: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<DayCampCustomFieldMaps> {
  const empty: DayCampCustomFieldMaps = {
    fullSummerGroupByPerson: new Map(),
    ageGroupByPerson: new Map(),
    matchedFields: {},
    debug: {
      fieldDefCount: 0,
      fieldDefSample: [],
      dataFetchErrors: [],
    },
  };

  if (!personIds.length) return empty;

  const requestedIdSet = new Set(personIds.map(String));
  const { defs, baseUsed } = await fetchCustomFieldDefs(
    token,
    subscriptionKey,
    clientId,
    acquireRateLimitSlot,
  );

  empty.debug.fieldDefCount = defs.length;
  empty.debug.fieldDefSample = defs
    .filter((d) => d.Name)
    .slice(0, 30)
    .map((d) => d.Name as string);
  empty.debug.groupCandidateFields = defs
    .filter((d) => d.Name && scoreFullSummerGroupDef(d) >= 50)
    .map((d) => `${d.Name} (id=${d.ID})`)
    .slice(0, 20);
  empty.debug.ageGroupCandidates = defs
    .filter((d) => d.Name && scoreAgeGroupDef(d) >= 40)
    .map((d) => `${d.Name} (id=${d.ID})`)
    .slice(0, 20);
  empty.debug.apiBaseUsed = baseUsed;

  const { fullSummerDef, ageGroupDef } = findFieldDefs(defs);

  if (!fullSummerDef?.ID && !ageGroupDef?.ID) {
    const groupLike = defs
      .filter((d) => d.Name && /group|age|division/i.test(d.Name))
      .map((d) => d.Name)
      .slice(0, 20);
    console.log(
      `[Custom Fields] No FULLSUMMERGROUP or Age Group defs found (${defs.length} total). Group-like names: ${groupLike.join(", ") || "none"}`,
    );
    return empty;
  }

  empty.matchedFields = {
    fullSummerGroup: fullSummerDef?.Name,
    ageGroup: ageGroupDef?.Name,
  };
  console.log(
    `[Custom Fields] Using defs: FULLSUMMERGROUP="${fullSummerDef?.Name ?? "n/a"}" (id=${fullSummerDef?.ID ?? "n/a"}), Age Group="${ageGroupDef?.Name ?? "n/a"}" (id=${ageGroupDef?.ID ?? "n/a"})`,
  );

  const fieldIds = [fullSummerDef?.ID, ageGroupDef?.ID].filter((id): id is number => typeof id === "number");
  const batchSize = 25;

  for (let i = 0; i < personIds.length; i += batchSize) {
    const batch = personIds.slice(i, i + batchSize);
    const numericIds = batch.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
    if (!numericIds.length) continue;

    try {
      const containers = await fetchCustomFieldDataBatch(
        numericIds,
        fieldIds,
        token,
        subscriptionKey,
        clientId,
        acquireRateLimitSlot,
        baseUsed,
      );

      if (i === 0) {
        empty.debug.firstBatchContainerCount = containers.length;
      }

      for (const container of containers) {
        const personId = resolvePersonIdFromContainer(container, requestedIdSet);
        if (!personId) continue;
        const data = container.Data || [];

        if (fullSummerDef?.ID) {
          const value = pickFieldValue(data, fullSummerDef.ID);
          if (value) empty.fullSummerGroupByPerson.set(personId, value);
        }
        if (ageGroupDef?.ID) {
          const value = pickFieldValue(data, ageGroupDef.ID);
          if (value) empty.ageGroupByPerson.set(personId, value);
        }
      }
    } catch (batchError) {
      const msg = batchError instanceof Error ? batchError.message : String(batchError);
      empty.debug.dataFetchErrors.push(msg);
      console.error(`[Custom Fields] Batch ${i / batchSize + 1} failed:`, msg);
    }
  }

  console.log(
    `[Custom Fields] Loaded ${empty.fullSummerGroupByPerson.size} FULLSUMMERGROUP, ${empty.ageGroupByPerson.size} age group values (season param=${season}, using latest field values)`,
  );
  return empty;
}

/** Create or update divisions from CampMinder age group labels. Returns label(lower) → division id. */
export async function ensureDivisionsForAgeGroupLabels(
  supabase: any,
  companyId: string,
  labels: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  if (!unique.length) return map;

  const { data: existing } = await supabase
    .from("divisions")
    .select("id, name, sort_order")
    .eq("company_id", companyId);

  const existingByName = new Map<string, { id: string; name: string; sort_order?: number }>(
    (existing || []).map((d: { id: string; name: string; sort_order?: number }) => [d.name.toLowerCase().trim(), d]),
  );

  let nextSort = Math.max(0, ...(existing || []).map((d: { sort_order?: number }) => d.sort_order ?? 0)) + 1;

  for (const label of unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const key = label.toLowerCase().trim();
    const found = existingByName.get(key);
    if (found) {
      map.set(key, found.id);
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("divisions")
      .insert({
        company_id: companyId,
        name: label,
        gender: "Coed",
        is_active: true,
        sort_order: nextSort++,
      })
      .select("id, name")
      .single();

    if (error) {
      console.error(`[Custom Fields] Failed to create division "${label}":`, error.message);
      continue;
    }
    if (inserted) {
      map.set(key, inserted.id);
      existingByName.set(key, inserted);
    }
  }

  return map;
}

export function resolveDivisionIdFromAgeGroupLabel(
  ageGroupLabel: string | null | undefined,
  ageGroupDivisionMap: Map<string, string>,
): string | null {
  if (!ageGroupLabel?.trim()) return null;
  return ageGroupDivisionMap.get(ageGroupLabel.toLowerCase().trim()) ?? null;
}
