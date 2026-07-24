import type { SupabaseClient } from "@supabase/supabase-js";
import { isAsNeededMedication } from "./medicationMealTimeDisplay";
import type { MedicationLogRow } from "./medicationSchedule";

const PAGE_SIZE = 1000;
const CACHE_TTL_MS = 60_000;

const MEDICATION_SELECT = `
  *,
  children (
    name,
    division_id,
    status,
    divisions (name)
  )
`;

type PrnReportCacheEntry = {
  rows: MedicationLogRow[];
  fetchedAt: number;
};

const prnReportCache = new Map<string, PrnReportCacheEntry>();

async function fetchPaginated<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await run(from, to);
    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchMedicationLogSlice(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  applyFilters: (
    query: ReturnType<SupabaseClient["from"]>,
  ) => ReturnType<SupabaseClient["from"]>,
): Promise<MedicationLogRow[]> {
  return fetchPaginated<MedicationLogRow>((from, to) => {
    const query = applyFilters(
      supabase
        .from("medication_logs")
        .select(MEDICATION_SELECT)
        .eq("company_id", companyId)
        .eq("season", season)
        .order("date", { ascending: false })
        .order("id", { ascending: false }),
    );

    return query.range(from, to);
  });
}

function profileKey(row: MedicationLogRow): string {
  return [
    row.child_id,
    String(row.medication_name ?? "").trim().toLowerCase(),
    String(row.dosage ?? "").trim().toLowerCase(),
  ].join("|");
}

function dedupeRowsById(rows: MedicationLogRow[]): MedicationLogRow[] {
  const byId = new Map<string, MedicationLogRow>();
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return Array.from(byId.values());
}

function collapseToProfiles(rows: MedicationLogRow[]): MedicationLogRow[] {
  const byProfile = new Map<string, MedicationLogRow>();
  for (const row of rows) {
    const key = profileKey(row);
    const existing = byProfile.get(key);
    if (!existing) {
      byProfile.set(key, row);
      continue;
    }
    const rowAdministered = Boolean(row.administered);
    const existingAdministered = Boolean(existing.administered);
    if (rowAdministered && !existingAdministered) {
      byProfile.set(key, row);
      continue;
    }
    if (row.date > existing.date) {
      byProfile.set(key, row);
    }
  }
  return Array.from(byProfile.values());
}

function sortPrnRows(rows: MedicationLogRow[]): MedicationLogRow[] {
  return [...rows].sort((a, b) => {
    const divA =
      (a as MedicationLogRow & { children?: { divisions?: { name?: string } } }).children
        ?.divisions?.name ?? "";
    const divB =
      (b as MedicationLogRow & { children?: { divisions?: { name?: string } } }).children
        ?.divisions?.name ?? "";
    if (divA !== divB) return divA.localeCompare(divB);
    const nameA =
      (a as MedicationLogRow & { children?: { name?: string } }).children?.name ?? "";
    const nameB =
      (b as MedicationLogRow & { children?: { name?: string } }).children?.name ?? "";
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return String(a.medication_name ?? "").localeCompare(String(b.medication_name ?? ""));
  });
}

/**
 * PRN profile meds only — avoids scanning every daily medication log row for the season.
 */
async function fetchPrnCandidateRows(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<MedicationLogRow[]> {
  const [recurringTemplates, nonRecurringProfiles, frequencyPrnRows] = await Promise.all([
    fetchMedicationLogSlice(supabase, companyId, season, (query) =>
      query.eq("is_recurring", true),
    ),
    fetchMedicationLogSlice(supabase, companyId, season, (query) =>
      query.eq("is_recurring", false).is("scheduled_time", null).is("meal_time", null),
    ),
    fetchMedicationLogSlice(supabase, companyId, season, (query) =>
      query.or("frequency.ilike.%PRN%,frequency.ilike.%as needed%"),
    ),
  ]);

  return dedupeRowsById([...recurringTemplates, ...nonRecurringProfiles, ...frequencyPrnRows]);
}

/** One row per camper + medication (PRN profile meds, not daily schedule slots). */
export async function fetchAsNeededMedicationsForReporting(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  options?: { bypassCache?: boolean },
): Promise<MedicationLogRow[]> {
  const cacheKey = `${companyId}|${season}`;
  const cached = prnReportCache.get(cacheKey);
  if (!options?.bypassCache && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rows;
  }

  const candidates = await fetchPrnCandidateRows(supabase, companyId, season);

  const activeRows = candidates.filter((row) => {
    const child = (row as MedicationLogRow & {
      children?: { status?: string | null };
    }).children;
    const status = String(child?.status ?? "active").toLowerCase();
    return status !== "inactive";
  });

  const prnRows = activeRows.filter((row) => isAsNeededMedication(row));
  const result = sortPrnRows(collapseToProfiles(prnRows));

  prnReportCache.set(cacheKey, { rows: result, fetchedAt: Date.now() });
  return result;
}

export function clearAsNeededMedicationReportCache(companyId?: string, season?: string): void {
  if (companyId && season) {
    prnReportCache.delete(`${companyId}|${season}`);
    return;
  }
  prnReportCache.clear();
}
