import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeCsvPersonId } from "@/lib/csvPersonIdResolve";
import { normalizeSpreadsheetDate } from "@/lib/spreadsheetDates";
import { pickCell, parseYesNo } from "@/lib/spreadsheetRowUtils";
import { shouldRemoveDayOffRecord } from "@/lib/odNightOffSchedule";

export type StaffDaysOffCsvUploadResult = {
  success: number;
  failed: number;
  errors: string[];
};

export const staffDaysOffCsvSchema = z.object({
  person_id: z.string().min(1, "Person ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  is_day_off: z.boolean(),
  is_night_off: z.boolean(),
  notes: z.string().nullable().optional(),
});

export function parseStaffDaysOffRow(row: Record<string, unknown>) {
  const person_id = normalizeCsvPersonId(
    pickCell(row, "person_id", "Person ID", "PersonID", "personid", "Staff Person ID"),
  );
  const dateRaw = pickCell(row, "date", "Date", "DATE");
  const date = normalizeSpreadsheetDate(dateRaw) ?? normalizeSpreadsheetDate(row.date) ?? "";

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

  const is_day_off = dayOffRaw ? parseYesNo(dayOffRaw) : false;
  const is_night_off = nightOffRaw ? parseYesNo(nightOffRaw) : false;
  const notes = pickCell(row, "notes", "Notes", "NOTES") || null;

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
12345678,2026-07-21,no,yes,Tuesday night off`;

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
      errors: ["Maximum 500 rows allowed per upload."],
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

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2;
    try {
      const parsed = parseStaffDaysOffRow(rows[i]);
      const validated = staffDaysOffCsvSchema.parse(parsed);

      if (!validated.is_day_off && !validated.is_night_off) {
        result.failed++;
        result.errors.push(`Row ${rowNumber}: Set Day Off and/or Night Off to yes`);
        continue;
      }

      const staffId = staffByPersonId.get(validated.person_id.toLowerCase().trim());
      if (!staffId) {
        result.failed++;
        result.errors.push(`Row ${rowNumber}: Staff with Person ID "${validated.person_id}" not found`);
        continue;
      }

      const { data: existing, error: existingErr } = await supabase
        .from("staff_days_off")
        .select(
          "id, is_day_off, is_night_off, is_sleeping_out, checked_out, checked_in, late_override",
        )
        .eq("company_id", companyId)
        .eq("season", season)
        .eq("staff_id", staffId)
        .eq("date", validated.date)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existing) {
        const merged = {
          ...existing,
          is_day_off: validated.is_day_off,
          is_night_off: validated.is_night_off,
          notes: validated.notes ?? null,
        };

        if (shouldRemoveDayOffRecord(merged)) {
          const { error: deleteErr } = await supabase
            .from("staff_days_off")
            .delete()
            .eq("id", existing.id);
          if (deleteErr) throw deleteErr;
        } else {
          const { error: updateErr } = await supabase
            .from("staff_days_off")
            .update({
              is_day_off: validated.is_day_off,
              is_night_off: validated.is_night_off,
              notes: validated.notes ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (updateErr) throw updateErr;
        }
      } else {
        const { error: insertErr } = await supabase.from("staff_days_off").insert({
          company_id: companyId,
          staff_id: staffId,
          date: validated.date,
          season,
          is_day_off: validated.is_day_off,
          is_night_off: validated.is_night_off,
          is_sleeping_out: false,
          notes: validated.notes ?? null,
        });
        if (insertErr) throw insertErr;
      }

      result.success++;
    } catch (error) {
      result.failed++;
      if (error instanceof z.ZodError) {
        result.errors.push(`Row ${rowNumber}: ${error.errors.map((e) => e.message).join(", ")}`);
      } else {
        result.errors.push(
          `Row ${rowNumber}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  return result;
}
