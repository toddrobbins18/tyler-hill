import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeCsvPersonId } from "@/lib/csvPersonIdResolve";
import { normalizeSpreadsheetDate } from "@/lib/spreadsheetDates";
import { pickCell, parseYesNo } from "@/lib/spreadsheetRowUtils";
import { shouldRemoveDayOffRecord } from "@/lib/odNightOffSchedule";
import { getSeasonDateRange, preprocessStaffDaysOffUploadRows } from "@/lib/odWeeklyDayOffPatterns";

export type StaffDaysOffCsvUploadResult = {
  success: number;
  failed: number;
  errors: string[];
  patternStaffCount?: number;
  skippedLegendRows?: number;
  expandedRowCount?: number;
};

const UPSERT_CHUNK_SIZE = 150;
const MAX_ERROR_LINES = 40;

export const staffDaysOffCsvSchema = z.object({
  person_id: z.string().min(1, "Person ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  is_day_off: z.boolean(),
  is_night_off: z.boolean(),
  notes: z.string().nullable().optional(),
});

type ValidatedRow = z.infer<typeof staffDaysOffCsvSchema> & { staff_id: string };

type ExistingDayOffRow = {
  id: string;
  staff_id: string;
  date: string;
  is_day_off: boolean | null;
  is_night_off: boolean | null;
  is_sleeping_out: boolean | null;
  checked_out: boolean | null;
  checked_in: boolean | null;
  late_override: boolean | null;
};

export function parseStaffDaysOffRow(row: Record<string, unknown>) {
  const person_id = normalizeCsvPersonId(
    pickCell(row, "person_id", "Person ID", "PersonID", "personid", "Staff Person ID") ||
      (typeof row.person_id === "string" ? row.person_id : ""),
  );
  const dateRaw = pickCell(row, "date", "Date", "DATE");
  const date =
    (typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date)
      ? row.date
      : null) ??
    normalizeSpreadsheetDate(dateRaw) ??
    normalizeSpreadsheetDate(row.date) ??
    "";

  const dayOffRaw = pickCell(
    row,
    "day_off",
    "Day Off",
    "day off",
    "DAY OFF",
    "is_day_off",
    "Is Day Off",
  );
  const nightOffRaw = pickCell(
    row,
    "night_off",
    "Night Off",
    "night off",
    "NIGHT OFF",
    "is_night_off",
    "Is Night Off",
  );

  const is_day_off =
    typeof row.is_day_off === "boolean"
      ? row.is_day_off
      : dayOffRaw
        ? parseYesNo(dayOffRaw)
        : false;
  const is_night_off =
    typeof row.is_night_off === "boolean"
      ? row.is_night_off
      : nightOffRaw
        ? parseYesNo(nightOffRaw)
        : false;
  const notes =
    pickCell(row, "notes", "Notes", "NOTES") ||
    (typeof row.notes === "string" ? row.notes : null) ||
    null;

  return {
    person_id,
    date,
    is_day_off,
    is_night_off,
    notes,
  };
}

export const STAFF_DAYS_OFF_CSV_TEMPLATE = `Person ID,Date,Day Off,Night Off,Notes
12345678,2026-07-15,yes,no,Wednesday day off
12345678,2026-07-17,no,yes,Friday night off
12345678,2026-07-20,no,yes,Monday night off
12345678,2026-07-21,no,yes,Tuesday night off

--- OR weekly pattern format (Tyler Hill OD sheet) ---
PersonID,Day Off
20424253,THURSDAY
20542345,TUESDAY
20599277,WEDNESDAY`;

function pushError(result: StaffDaysOffCsvUploadResult, message: string) {
  result.failed++;
  if (result.errors.length < MAX_ERROR_LINES) {
    result.errors.push(message);
  }
}

async function fetchExistingDayOffRows(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<Map<string, ExistingDayOffRow>> {
  const { start, end } = getSeasonDateRange(season);
  const map = new Map<string, ExistingDayOffRow>();
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("staff_days_off")
      .select(
        "id, staff_id, date, is_day_off, is_night_off, is_sleeping_out, checked_out, checked_in, late_override",
      )
      .eq("company_id", companyId)
      .eq("season", season)
      .gte("date", start)
      .lte("date", end)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      map.set(`${row.staff_id}|${row.date}`, row as ExistingDayOffRow);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return map;
}

export async function importStaffDaysOffSchedule(
  supabase: SupabaseClient,
  params: {
    companyId: string;
    season: string;
    rows: Record<string, unknown>[];
  },
): Promise<StaffDaysOffCsvUploadResult> {
  const { companyId, season, rows } = params;
  const result: StaffDaysOffCsvUploadResult = { success: 0, failed: 0, errors: [] };

  if (rows.length > 500) {
    return {
      success: 0,
      failed: rows.length,
      errors: ["Maximum 500 spreadsheet rows allowed per upload."],
    };
  }

  const preprocessed = preprocessStaffDaysOffUploadRows(rows, season);
  result.patternStaffCount = preprocessed.patternStaffCount;
  result.skippedLegendRows = preprocessed.skippedLegendRows;
  result.expandedRowCount = preprocessed.expandedRowCount;

  if (preprocessed.rows.length === 0) {
    return {
      ...result,
      failed: rows.length,
      errors: [
        "No valid rows found. Use Person ID + Date rows, or PersonID + weekday (TUESDAY/WEDNESDAY/THURSDAY) for weekly patterns.",
      ],
    };
  }

  if (preprocessed.rows.length > 15000) {
    return {
      ...result,
      failed: preprocessed.rows.length,
      errors: ["Expanded schedule exceeds 15,000 rows. Upload fewer staff or use dated rows for a shorter range."],
    };
  }

  const { data: staffRows, error: staffErr } = await supabase
    .from("staff")
    .select("id, person_id")
    .eq("company_id", companyId)
    .eq("season", season);

  if (staffErr) {
    return { success: 0, failed: rows.length, errors: [staffErr.message] };
  }

  const staffByPersonId = new Map<string, string>();
  for (const staff of staffRows || []) {
    if (staff.person_id) {
      staffByPersonId.set(String(staff.person_id).toLowerCase().trim(), staff.id);
    }
  }

  const validatedRows: ValidatedRow[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < preprocessed.rows.length; i++) {
    const rowNumber = i + 2;
    try {
      const parsed = parseStaffDaysOffRow(preprocessed.rows[i]);
      const validated = staffDaysOffCsvSchema.parse(parsed);

      if (!validated.is_day_off && !validated.is_night_off) {
        pushError(result, `Row ${rowNumber}: Set Day Off and/or Night Off to yes`);
        continue;
      }

      const staffId = staffByPersonId.get(validated.person_id.toLowerCase().trim());
      if (!staffId) {
        pushError(result, `Row ${rowNumber}: Staff with Person ID "${validated.person_id}" not found`);
        continue;
      }

      const dedupeKey = `${staffId}|${validated.date}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      validatedRows.push({ ...validated, staff_id: staffId });
    } catch (error) {
      if (error instanceof z.ZodError) {
        pushError(result, `Row ${rowNumber}: ${error.errors.map((e) => e.message).join(", ")}`);
      } else {
        pushError(
          result,
          `Row ${rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  if (validatedRows.length === 0) {
    if (result.errors.length >= MAX_ERROR_LINES) {
      result.errors.push(`...and more errors (showing first ${MAX_ERROR_LINES})`);
    }
    return result;
  }

  let existingMap: Map<string, ExistingDayOffRow>;
  try {
    existingMap = await fetchExistingDayOffRows(supabase, companyId, season);
  } catch (error) {
    return {
      ...result,
      failed: validatedRows.length,
      errors: [error instanceof Error ? error.message : "Failed to load existing schedule"],
    };
  }

  const toUpsert: Record<string, unknown>[] = [];
  const toDelete: string[] = [];
  const now = new Date().toISOString();

  for (const row of validatedRows) {
    const key = `${row.staff_id}|${row.date}`;
    const existing = existingMap.get(key);

    const merged = {
      ...(existing ?? {}),
      is_day_off: row.is_day_off,
      is_night_off: row.is_night_off,
      notes: row.notes ?? null,
    };

    if (existing && shouldRemoveDayOffRecord(merged as ExistingDayOffRow)) {
      toDelete.push(existing.id);
      continue;
    }

    toUpsert.push({
      company_id: companyId,
      staff_id: row.staff_id,
      date: row.date,
      season,
      is_day_off: row.is_day_off,
      is_night_off: row.is_night_off,
      is_sleeping_out: existing?.is_sleeping_out ?? false,
      checked_out: existing?.checked_out ?? false,
      checked_in: existing?.checked_in ?? false,
      notes: row.notes ?? null,
      updated_at: now,
    });
  }

  for (let i = 0; i < toDelete.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = toDelete.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from("staff_days_off").delete().in("id", chunk);
    if (error) {
      pushError(result, `Delete batch failed: ${error.message}`);
      result.failed += chunk.length;
    } else {
      result.success += chunk.length;
    }
  }

  for (let i = 0; i < toUpsert.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = toUpsert.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase.from("staff_days_off").upsert(chunk, {
      onConflict: "company_id,staff_id,date,season",
    });
    if (error) {
      pushError(result, `Import batch failed: ${error.message}`);
      result.failed += chunk.length;
    } else {
      result.success += chunk.length;
    }
  }

  if (result.errors.length >= MAX_ERROR_LINES) {
    result.errors.push(`...showing first ${MAX_ERROR_LINES} errors`);
  }

  return result;
}
