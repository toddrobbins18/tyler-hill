/**
 * CampMinder Telegraph saved reports — FULLSUMMERGROUP via CSV export.
 * Todd setup: save report "Nest - Full Summer Groups" with Person ID + Full Summer Group columns.
 */

import {
  ensureDivisionsForAgeGroupLabels,
  resolveDivisionIdFromAgeGroupLabel,
} from "./campminderCustomFields.ts";

const CM_TELEGRAPH_API_BASES = [
  "https://webapi.campminder.com/api/telegraph",
  "https://api.campminder.com/telegraph",
  "https://api.campminder.com/customdata/telegraph",
  "https://api.campminder.com/entity/telegraph",
];

/** Report names to match (case-insensitive). First match wins. */
export const DEFAULT_FULL_SUMMER_GROUP_REPORT_NAMES = [
  "nest - full summer groups",
  "nest full summer groups",
  "full summer groups",
  "fullsummergroup",
  "full summer group",
];

const PERSON_ID_HEADERS = [
  "person id",
  "personid",
  "person_id",
  "person #",
  "person#",
  "cm person id",
  "campminder person id",
  "id",
];

const FULL_SUMMER_GROUP_HEADERS = [
  "full summer group",
  "fullsummergroup",
  "full summer groups",
  "summer group",
  "group",
  "full summer group name",
];

const AGE_GROUP_HEADERS = [
  "age group",
  "agegroup",
  "age groups",
  "assigned age group",
];

export type TelegraphGroupSyncResult = {
  reportId: number | null;
  reportName: string | null;
  apiBaseUsed?: string;
  csvRows: number;
  parsedRows: number;
  groupValues: number;
  ageGroupValues: number;
  childrenUpdated: number;
  divisionsUpdated: number;
  unmatchedPersonIds: number;
  availableReports: string[];
  errors: string[];
  skippedReason?: string;
};

type SavedReport = Record<string, unknown>;

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_\-#]+/g, " ").trim();
}

function headerMatches(header: string, candidates: string[]): boolean {
  const normalized = normalizeHeader(header);
  return candidates.some((c) => normalized === c || normalized.includes(c));
}

function pickColumnIndex(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (headerMatches(headers[i], candidates)) return i;
  }
  return -1;
}

function extractApiResult(payload: unknown): unknown[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ["Result", "Results", "data", "items"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }

  row.push(cur);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function reportDisplayName(report: SavedReport): string {
  const name = report.Name ?? report.Title ?? report.ReportName ?? report.Description ?? "";
  return String(name).trim();
}

function reportIdFromRecord(report: SavedReport): number | null {
  const raw = report.ReportID ?? report.ID ?? report.Id ?? report.id ?? report.ReportId;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function fetchTelegraphJson(
  path: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  query: Record<string, string | number>,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<{ payload: unknown; baseUsed: string } | null> {
  for (const base of CM_TELEGRAPH_API_BASES) {
    await acquireRateLimitSlot();
    const params = new URLSearchParams();
    params.set("clientid", clientId);
    for (const [key, value] of Object.entries(query)) {
      params.set(key, String(value));
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
      console.warn(`[Telegraph] ${url} → HTTP ${response.status}: ${text.slice(0, 160)}`);
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      const payload = await response.json();
      if (payload?.Success === false) {
        console.warn(`[Telegraph] ${url} → Success=false: ${payload?.ErrorText || "unknown"}`);
        continue;
      }
      return { payload, baseUsed: base };
    }

    const text = await response.text();
    return { payload: text, baseUsed: base };
  }

  return null;
}

async function fetchSavedReports(
  token: string,
  subscriptionKey: string,
  clientId: string,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<{ reports: SavedReport[]; baseUsed?: string }> {
  const response = await fetchTelegraphJson(
    "GetSavedReports",
    token,
    subscriptionKey,
    clientId,
    {},
    acquireRateLimitSlot,
  );
  if (!response) return { reports: [] };
  return {
    reports: extractApiResult(response.payload) as SavedReport[],
    baseUsed: response.baseUsed,
  };
}

function findSavedReport(
  reports: SavedReport[],
  preferredNames: string[],
): SavedReport | null {
  const normalizedPreferred = preferredNames.map((n) => n.toLowerCase().trim());

  for (const preferred of normalizedPreferred) {
    const exact = reports.find((r) => reportDisplayName(r).toLowerCase().trim() === preferred);
    if (exact) return exact;
  }

  for (const preferred of normalizedPreferred) {
    const loose = reports.find((r) => {
      const name = reportDisplayName(r).toLowerCase();
      return name.includes(preferred) || preferred.includes(name);
    });
    if (loose) return loose;
  }

  return null;
}

async function runSavedReportCsv(
  reportId: number,
  token: string,
  subscriptionKey: string,
  clientId: string,
  acquireRateLimitSlot: () => Promise<void>,
  preferredBase?: string,
): Promise<{ csvText: string; baseUsed: string } | null> {
  const bases = preferredBase
    ? [preferredBase, ...CM_TELEGRAPH_API_BASES.filter((b) => b !== preferredBase)]
    : CM_TELEGRAPH_API_BASES;

  for (const base of bases) {
    await acquireRateLimitSlot();
    const params = new URLSearchParams();
    params.set("clientid", clientId);
    params.set("reportID", String(reportId));

    const url = `${base}/RunSavedReportCsv?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[Telegraph] ${url} → HTTP ${response.status}: ${text.slice(0, 160)}`);
      continue;
    }

    const csvText = await response.text();
    if (csvText.trim()) return { csvText, baseUsed: base };
  }

  return null;
}

function parseTelegraphCsv(csvText: string): {
  groupByPerson: Map<string, string>;
  ageGroupByPerson: Map<string, string>;
  parsedRows: number;
} {
  const groupByPerson = new Map<string, string>();
  const ageGroupByPerson = new Map<string, string>();

  const rows = parseCsvRows(csvText.trim());
  if (rows.length < 2) return { groupByPerson, ageGroupByPerson, parsedRows: 0 };

  const headers = rows[0];
  const personIdx = pickColumnIndex(headers, PERSON_ID_HEADERS);
  const groupIdx = pickColumnIndex(headers, FULL_SUMMER_GROUP_HEADERS);
  const ageIdx = pickColumnIndex(headers, AGE_GROUP_HEADERS);

  if (personIdx < 0) {
    throw new Error(
      `Telegraph CSV missing Person ID column. Headers: ${headers.slice(0, 12).join(", ")}`,
    );
  }
  if (groupIdx < 0 && ageIdx < 0) {
    throw new Error(
      `Telegraph CSV missing Full Summer Group / Age Group column. Headers: ${headers.slice(0, 12).join(", ")}`,
    );
  }

  let parsedRows = 0;
  for (const row of rows.slice(1)) {
    const personId = String(row[personIdx] ?? "").trim();
    if (!personId || !/^\d+$/.test(personId)) continue;

    parsedRows++;
    if (groupIdx >= 0) {
      const group = String(row[groupIdx] ?? "").trim();
      if (group) groupByPerson.set(personId, group);
    }
    if (ageIdx >= 0) {
      const ageGroup = String(row[ageIdx] ?? "").trim();
      if (ageGroup) ageGroupByPerson.set(personId, ageGroup);
    }
  }

  return { groupByPerson, ageGroupByPerson, parsedRows };
}

async function applyTelegraphDataToChildren(
  supabase: any,
  companyId: string,
  season: string,
  groupByPerson: Map<string, string>,
  ageGroupByPerson: Map<string, string>,
): Promise<{ childrenUpdated: number; divisionsUpdated: number; unmatchedPersonIds: number }> {
  let childrenUpdated = 0;
  let divisionsUpdated = 0;
  let unmatchedPersonIds = 0;

  let ageGroupDivisionMap = new Map<string, string>();
  if (ageGroupByPerson.size > 0) {
    ageGroupDivisionMap = await ensureDivisionsForAgeGroupLabels(
      supabase,
      companyId,
      [...new Set(ageGroupByPerson.values())],
    );
  }

  const personIds = [...new Set([...groupByPerson.keys(), ...ageGroupByPerson.keys()])];
  for (let i = 0; i < personIds.length; i += 50) {
    const batch = personIds.slice(i, i + 50);
    const { data: children, error } = await supabase
      .from("children")
      .select("id, person_id, group_name, division_id")
      .eq("company_id", companyId)
      .eq("season", season)
      .in("person_id", batch);

    if (error) {
      console.error("[Telegraph] Failed to load children batch:", error.message);
      continue;
    }

    for (const child of children || []) {
      const pid = String(child.person_id);
      const patch: Record<string, unknown> = {};
      const group = groupByPerson.get(pid);
      const ageGroup = ageGroupByPerson.get(pid);

      if (group && group !== (child.group_name ?? "")) {
        patch.group_name = group;
      }

      if (ageGroup) {
        const divisionId = resolveDivisionIdFromAgeGroupLabel(ageGroup, ageGroupDivisionMap);
        if (divisionId && divisionId !== child.division_id) {
          patch.division_id = divisionId;
          divisionsUpdated++;
        }
      }

      if (Object.keys(patch).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("children")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", child.id);

      if (updateErr) {
        console.error(`[Telegraph] Update failed for child ${child.id}:`, updateErr.message);
      } else {
        childrenUpdated++;
      }
    }

    const matched = new Set((children || []).map((c: { person_id: string }) => String(c.person_id)));
    for (const pid of batch) {
      if ((groupByPerson.has(pid) || ageGroupByPerson.has(pid)) && !matched.has(pid)) {
        unmatchedPersonIds++;
      }
    }
  }

  return { childrenUpdated, divisionsUpdated, unmatchedPersonIds };
}

/** Pull FULLSUMMERGROUP (and optional Age Group) from a CampMinder Telegraph saved report CSV. */
export async function syncFullSummerGroupsFromTelegraph(
  supabase: any,
  companyId: string,
  season: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  acquireRateLimitSlot: () => Promise<void>,
  reportNameCandidates: string[] = DEFAULT_FULL_SUMMER_GROUP_REPORT_NAMES,
): Promise<TelegraphGroupSyncResult> {
  const result: TelegraphGroupSyncResult = {
    reportId: null,
    reportName: null,
    csvRows: 0,
    parsedRows: 0,
    groupValues: 0,
    ageGroupValues: 0,
    childrenUpdated: 0,
    divisionsUpdated: 0,
    unmatchedPersonIds: 0,
    availableReports: [],
    errors: [],
  };

  try {
    const { reports, baseUsed } = await fetchSavedReports(
      token,
      subscriptionKey,
      clientId,
      acquireRateLimitSlot,
    );
    result.apiBaseUsed = baseUsed;
    result.availableReports = reports
      .map((r) => {
        const id = reportIdFromRecord(r);
        const name = reportDisplayName(r);
        return id != null && name ? `${name} (id=${id})` : name || (id != null ? `id=${id}` : "");
      })
      .filter(Boolean)
      .slice(0, 30);

    if (!reports.length) {
      result.skippedReason =
        "No saved Telegraph reports returned — create 'Nest - Full Summer Groups' in CampMinder";
      console.log(`[Telegraph] ${result.skippedReason}`);
      return result;
    }

    const report = findSavedReport(reports, reportNameCandidates);
    const reportId = report ? reportIdFromRecord(report) : null;
    const reportName = report ? reportDisplayName(report) : null;

    if (!report || reportId == null) {
      result.skippedReason =
        `Report not found — looking for one of: ${reportNameCandidates.join(", ")}`;
      console.log(`[Telegraph] ${result.skippedReason}`);
      console.log(`[Telegraph] Available: ${result.availableReports.join("; ") || "none"}`);
      return result;
    }

    result.reportId = reportId;
    result.reportName = reportName;
    console.log(`[Telegraph] Using report "${reportName}" (id=${reportId})`);

    const csvResponse = await runSavedReportCsv(
      reportId,
      token,
      subscriptionKey,
      clientId,
      acquireRateLimitSlot,
      baseUsed,
    );

    if (!csvResponse?.csvText) {
      result.skippedReason = "RunSavedReportCsv returned empty CSV";
      console.warn(`[Telegraph] ${result.skippedReason}`);
      return result;
    }

    result.csvRows = parseCsvRows(csvResponse.csvText).length;
    const { groupByPerson, ageGroupByPerson, parsedRows } = parseTelegraphCsv(csvResponse.csvText);
    result.parsedRows = parsedRows;
    result.groupValues = groupByPerson.size;
    result.ageGroupValues = ageGroupByPerson.size;

    if (groupByPerson.size === 0 && ageGroupByPerson.size === 0) {
      result.skippedReason = "CSV parsed but no group/age group values found";
      console.warn(`[Telegraph] ${result.skippedReason}`);
      return result;
    }

    const apply = await applyTelegraphDataToChildren(
      supabase,
      companyId,
      season,
      groupByPerson,
      ageGroupByPerson,
    );
    result.childrenUpdated = apply.childrenUpdated;
    result.divisionsUpdated = apply.divisionsUpdated;
    result.unmatchedPersonIds = apply.unmatchedPersonIds;

    console.log(
      `[Telegraph] Applied ${result.groupValues} groups, ${result.ageGroupValues} age groups → ${result.childrenUpdated} children updated`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    console.error("[Telegraph] Error:", msg);
  }

  return result;
}
