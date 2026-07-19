import type { SupabaseClient } from "@supabase/supabase-js";
import { pickCell } from "@/lib/spreadsheetRowUtils";
import {
  type OdWeeklyPatternKey,
  weeklyPatternKeyFromDayOffColumn,
} from "@/lib/odWeeklyDayOffPatterns";

export type OdBunkSheetPatternRow = {
  bunk: string;
  staff_name: string;
  pattern_key: OdWeeklyPatternKey;
  source_row: number;
};

export type OdBunkSheetParseResult = {
  isBunkSheet: boolean;
  patternRows: OdBunkSheetPatternRow[];
  skippedLegendRows: number;
  duplicateRows: number;
};

const LEGEND_PATTERN =
  /^(bunk\s*name\s*day\s*of|night\s*of|od\s*sign[\s-]*in|sign[\s-]*out|sign[\s-]*in|sleeping\s*out)$/i;

export function normalizeOdStaffName(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
}

export function looksLikeOdBunkCode(value: string): boolean {
  return /^(B\d+|SH)$/i.test(value.trim());
}

function rowValues(row: Record<string, unknown>): string[] {
  return Object.values(row)
    .filter((value) => value != null && String(value).trim() !== "")
    .map((value) => String(value).trim());
}

function pickDayOffCell(row: Record<string, unknown>): string {
  const direct = pickCell(
    row,
    "day_of",
    "Day Of",
    "day off",
    "Day Off",
    "DAY OFF",
    "is_day_off",
    "Is Day Off",
  );
  if (weeklyPatternKeyFromDayOffColumn(direct)) return direct;

  for (const value of rowValues(row)) {
    if (weeklyPatternKeyFromDayOffColumn(value)) return value;
  }
  return "";
}

function pickBunkCell(row: Record<string, unknown>): string {
  const direct = pickCell(row, "bunk", "Bunk", "Bunk Name", "bunk_name");
  if (looksLikeOdBunkCode(direct)) return direct.trim().toUpperCase();

  for (const value of rowValues(row)) {
    if (looksLikeOdBunkCode(value)) return value.trim().toUpperCase();
  }
  return "";
}

function pickStaffNameCell(row: Record<string, unknown>, bunk: string, dayOff: string): string {
  const direct = pickCell(row, "name", "Name", "Staff Name", "staff name");
  if (direct && !looksLikeOdBunkCode(direct) && !weeklyPatternKeyFromDayOffColumn(direct)) {
    return direct;
  }

  const ignored = new Set(
    [bunk, dayOff, ...rowValues(row).filter((value) => looksLikeOdBunkCode(value) || weeklyPatternKeyFromDayOffColumn(value))]
      .map((value) => value.trim().toLowerCase()),
  );

  const parts = rowValues(row).filter((value) => !ignored.has(value.trim().toLowerCase()));
  return parts.join(" ").trim();
}

function isLegendRow(row: Record<string, unknown>): boolean {
  const joined = rowValues(row).join(" ").trim();
  if (!joined) return true;
  if (/^bunk\s+name\s+day\s+of/i.test(joined)) return true;
  if (/\b(night\s+of|od\s+sign[\s-]*in|sign[\s-]*out|sleeping\s+out)\b/i.test(joined)) {
    return true;
  }

  const bunk = pickBunkCell(row);
  const dayOff = pickDayOffCell(row);
  const name = pickStaffNameCell(row, bunk, dayOff);
  if (!bunk && !name && !dayOff) return true;

  for (const value of rowValues(row)) {
    if (LEGEND_PATTERN.test(value.trim())) return true;
    if (/^\d+$/.test(value.trim()) && rowValues(row).length === 1) return true;
  }

  return false;
}

type PartialPatternRow = {
  bunk: string;
  staff_name: string;
  pattern_key: OdWeeklyPatternKey | null;
  source_row: number;
};

function mergePartialRows(rows: PartialPatternRow[]): OdBunkSheetPatternRow[] {
  const merged: PartialPatternRow[] = [];
  let pending: PartialPatternRow | null = null;

  for (const row of rows) {
    if (row.bunk && row.staff_name && row.pattern_key) {
      if (pending) merged.push(pending);
      merged.push(row);
      pending = null;
      continue;
    }

    if (row.bunk && row.staff_name && !row.pattern_key) {
      if (pending) merged.push(pending);
      pending = row;
      continue;
    }

    if (!row.bunk && pending) {
      if (row.staff_name) {
        pending.staff_name = `${pending.staff_name} ${row.staff_name}`.replace(/\s+/g, " ").trim();
      }
      if (row.pattern_key) pending.pattern_key = row.pattern_key;
      if (pending.staff_name && pending.pattern_key) {
        merged.push(pending);
        pending = null;
      }
    }
  }

  if (pending?.staff_name && pending.pattern_key) merged.push(pending);
  return merged.filter((row): row is OdBunkSheetPatternRow => Boolean(row.pattern_key));
}

export function looksLikeOdBunkSheet(rows: Record<string, unknown>[]): boolean {
  let bunkRows = 0;
  for (const row of rows) {
    if (isLegendRow(row)) continue;
    const bunk = pickBunkCell(row);
    const dayOff = pickDayOffCell(row);
    if (bunk && dayOff) bunkRows += 1;
  }
  return bunkRows >= 3;
}

export function parseOdBunkSheetUpload(rows: Record<string, unknown>[]): OdBunkSheetParseResult {
  if (!looksLikeOdBunkSheet(rows)) {
    return { isBunkSheet: false, patternRows: [], skippedLegendRows: 0, duplicateRows: 0 };
  }

  const partialRows: PartialPatternRow[] = [];
  let skippedLegendRows = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (isLegendRow(row)) {
      skippedLegendRows += 1;
      continue;
    }

    const bunk = pickBunkCell(row);
    const dayOff = pickDayOffCell(row);
    const patternKey = dayOff ? weeklyPatternKeyFromDayOffColumn(dayOff) : null;
    const staffName = pickStaffNameCell(row, bunk, dayOff);

    if (!bunk || !staffName) {
      skippedLegendRows += 1;
      continue;
    }

    partialRows.push({
      bunk,
      staff_name: staffName,
      pattern_key: patternKey,
      source_row: index + 2,
    });
  }

  const mergedRows = mergePartialRows(partialRows);
  const deduped = new Map<string, OdBunkSheetPatternRow>();
  let duplicateRows = 0;

  for (const row of mergedRows) {
    const key = `${normalizeOdStaffName(row.staff_name)}|${row.pattern_key}`;
    if (deduped.has(key)) {
      duplicateRows += 1;
      continue;
    }
    deduped.set(key, row);
  }

  return {
    isBunkSheet: true,
    patternRows: [...deduped.values()],
    skippedLegendRows,
    duplicateRows,
  };
}

type StaffRecord = { id: string; person_id: string | null; name: string | null };

function bunkRefsForRecord(bunkNumber: string | null, bunkName: string | null): string[] {
  const refs = new Set<string>();
  const number = String(bunkNumber ?? "").trim();
  const name = String(bunkName ?? "").trim().toUpperCase();
  if (number) refs.add(`B${number}`.toUpperCase());
  if (name) refs.add(name);
  if (name.includes("SENIOR") || name === "SH") refs.add("SH");
  return [...refs];
}

function namesMatch(sheetName: string, staffName: string): boolean {
  const left = normalizeOdStaffName(sheetName);
  const right = normalizeOdStaffName(staffName);
  if (!left || !right) return false;
  if (left === right) return true;
  return right.includes(left) || left.includes(right);
}

function pickStaffMatch(candidates: StaffRecord[], sheetName: string): StaffRecord | undefined {
  const exact = candidates.filter((staff) => normalizeOdStaffName(staff.name ?? "") === normalizeOdStaffName(sheetName));
  if (exact.length === 1) return exact[0];

  const partial = candidates.filter((staff) => namesMatch(sheetName, staff.name ?? ""));
  if (partial.length === 1) return partial[0];
  return undefined;
}

export async function resolveOdBunkSheetPatterns(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    season: string;
    patternRows: OdBunkSheetPatternRow[];
    errors: string[];
    maxErrors?: number;
  },
): Promise<Record<string, unknown>[]> {
  const { companyId, season, patternRows, errors, maxErrors = 40 } = params;

  const [{ data: staffRows, error: staffErr }, { data: bunkStaffRows, error: bunkStaffErr }] =
    await Promise.all([
      supabase
        .from("staff")
        .select("id, person_id, name")
        .eq("company_id", companyId)
        .eq("season", season),
      supabase
        .from("bunk_staff")
        .select("staff_id, bunk:bunk_id(bunk_number, bunk_name)")
        .eq("company_id", companyId),
    ]);

  if (staffErr) throw staffErr;
  if (bunkStaffErr) throw bunkStaffErr;

  const staffList = (staffRows || []) as StaffRecord[];
  const staffIdsByBunkRef = new Map<string, Set<string>>();

  for (const assignment of bunkStaffRows || []) {
    const bunk = assignment.bunk as { bunk_number: string | null; bunk_name: string | null } | null;
    if (!bunk) continue;
    for (const ref of bunkRefsForRecord(bunk.bunk_number, bunk.bunk_name)) {
      const set = staffIdsByBunkRef.get(ref) ?? new Set<string>();
      set.add(assignment.staff_id);
      staffIdsByBunkRef.set(ref, set);
    }
  }

  const resolvedRows: Record<string, unknown>[] = [];

  for (const row of patternRows) {
    const bunkStaffIds = staffIdsByBunkRef.get(row.bunk.toUpperCase());
    const bunkCandidates = bunkStaffIds
      ? staffList.filter((staff) => bunkStaffIds.has(staff.id))
      : [];

    let match = bunkCandidates.length > 0 ? pickStaffMatch(bunkCandidates, row.staff_name) : undefined;
    if (!match) match = pickStaffMatch(staffList, row.staff_name);

    if (!match?.person_id) {
      if (errors.length < maxErrors) {
        errors.push(
          `Row ${row.source_row}: Staff "${row.staff_name}" (${row.bunk}) not found or missing Person ID`,
        );
      }
      continue;
    }

    resolvedRows.push({
      PersonID: match.person_id,
      person_id: match.person_id,
      "Day Off": row.pattern_key.toUpperCase(),
      day_off: row.pattern_key.toUpperCase(),
    });
  }

  return resolvedRows;
}
