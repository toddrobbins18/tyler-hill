import type { SupabaseClient } from "@supabase/supabase-js";

const PERSON_ID_BATCH_SIZE = 500;

/** Normalize Person IDs from spreadsheets (Excel floats, trailing `.0`, whitespace). */
export function normalizeCsvPersonId(raw: unknown): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  let s = String(raw).trim();
  if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, "");
  }
  return s;
}

type ResolveOptions = {
  /** Match inactive roster rows (needed for meds/notes linked to dropped campers). */
  includeInactive?: boolean;
};

/** Batched lookup: person_id → children.id for the selected company + season. */
export async function resolveChildPersonIdsBatched(
  client: SupabaseClient,
  companyId: string,
  season: string,
  personIds: string[],
  options: ResolveOptions = {},
): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(personIds.map((id) => normalizeCsvPersonId(id)).filter(Boolean)),
  );
  if (!companyId || unique.length === 0) return new Map();

  const mapping = new Map<string, string>();

  for (let i = 0; i < unique.length; i += PERSON_ID_BATCH_SIZE) {
    const batch = unique.slice(i, i + PERSON_ID_BATCH_SIZE);
    let query = client
      .from("children")
      .select("id, person_id, status")
      .eq("company_id", companyId)
      .eq("season", season)
      .in("person_id", batch);

    if (!options.includeInactive) {
      query = query.neq("status", "inactive");
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    (data || []).forEach((child: { id: string; person_id: string | null }) => {
      const pid = normalizeCsvPersonId(child.person_id);
      if (pid) mapping.set(pid, child.id);
    });
  }

  return mapping;
}

type PersonIdDiagnostic = {
  personId: string;
  status?: string;
  season?: string;
  name?: string;
};

/** Explain why Person IDs from a CSV did not resolve (inactive, wrong season, missing). */
export async function describeMissingChildPersonIds(
  client: SupabaseClient,
  companyId: string,
  season: string,
  missingIds: string[],
): Promise<string[]> {
  const unique = Array.from(new Set(missingIds.map(normalizeCsvPersonId).filter(Boolean)));
  if (!companyId || unique.length === 0) return [];

  const found: PersonIdDiagnostic[] = [];

  for (let i = 0; i < unique.length; i += PERSON_ID_BATCH_SIZE) {
    const batch = unique.slice(i, i + PERSON_ID_BATCH_SIZE);
    const { data } = await client
      .from("children")
      .select("person_id, status, season, name")
      .eq("company_id", companyId)
      .in("person_id", batch);

    (data || []).forEach(
      (row: { person_id: string | null; status: string | null; season: string; name: string }) => {
        const pid = normalizeCsvPersonId(row.person_id);
        if (pid) {
          found.push({
            personId: pid,
            status: row.status ?? undefined,
            season: row.season,
            name: row.name,
          });
        }
      },
    );
  }

  const foundById = new Map(found.map((f) => [f.personId, f]));

  return unique.map((pid) => {
    const match = foundById.get(pid);
    if (!match) {
      return `Person ID "${pid}" is not in your roster — import/sync campers for season ${season} first.`;
    }
    if (match.season && match.season !== season) {
      return `Person ID "${pid}" (${match.name ?? "camper"}) is on season ${match.season}, not ${season}. Change season in Settings or fix the spreadsheet.`;
    }
    if (match.status === "inactive") {
      return `Person ID "${pid}" (${match.name ?? "camper"}) is inactive — re-import the camper roster (merge) or set status to active.`;
    }
    return `Person ID "${pid}" could not be matched — check for typos or extra characters in the spreadsheet.`;
  });
}

export function personIdResolutionHint(season: string): string {
  return (
    `\n\nEach Person ID must match a camper in your roster for season ${season} (Settings). ` +
    "Import/sync the roster first, fix wrong IDs in the spreadsheet, or choose the correct season."
  );
}
