import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeMedicationsForDate, type MedicationLogRow } from "./medicationSchedule";

const PAGE_SIZE = 1000;

const MEDICATION_SELECT = `
  *,
  children (
    name,
    division_id,
    divisions (name)
  )
`;

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

/** Date range for medication reports when end date is omitted. */
export function resolveMedicationReportDateRange(
  startDate: string,
  endDate: string,
): { rangeStart: string; rangeEnd: string } {
  const todayYmd = format(new Date(), "yyyy-MM-dd");
  const rangeStart = startDate || todayYmd;
  const rangeEnd =
    endDate ||
    (startDate ? format(addDays(parseISO(startDate), 31), "yyyy-MM-dd") : todayYmd);
  return { rangeStart, rangeEnd };
}

/**
 * Build a day-by-day medication schedule for reporting (includes recurring templates).
 */
export async function fetchExpandedMedicationSchedule(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  startYmd: string,
  endYmd: string,
): Promise<MedicationLogRow[]> {
  const { rangeStart, rangeEnd } = resolveMedicationReportDateRange(startYmd, endYmd);

  const [rangeRows, recurringTemplates] = await Promise.all([
    fetchPaginated<MedicationLogRow>((from, to) =>
      supabase
        .from("medication_logs")
        .select(MEDICATION_SELECT)
        .eq("company_id", companyId)
        .eq("season", season)
        .gte("date", rangeStart)
        .lte("date", rangeEnd)
        .order("date")
        .order("id")
        .range(from, to),
    ),
    fetchPaginated<MedicationLogRow>((from, to) =>
      supabase
        .from("medication_logs")
        .select(MEDICATION_SELECT)
        .eq("company_id", companyId)
        .eq("season", season)
        .eq("is_recurring", true)
        .lte("date", rangeEnd)
        .or(`end_date.is.null,end_date.gte.${rangeStart}`)
        .order("date")
        .order("id")
        .range(from, to),
    ),
  ]);

  const days = eachDayOfInterval({
    start: parseISO(rangeStart),
    end: parseISO(rangeEnd),
  });

  const expanded: MedicationLogRow[] = [];

  for (const day of days) {
    const dateYmd = format(day, "yyyy-MM-dd");
    const dayRows = rangeRows.filter((row) => row.date === dateYmd);
    const merged = mergeMedicationsForDate(
      dayRows,
      recurringTemplates,
      dateYmd,
      season,
    );

    for (const row of merged) {
      expanded.push({
        ...row,
        date: dateYmd,
        _displayDate: dateYmd,
      });
    }
  }

  return expanded;
}
