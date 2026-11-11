import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseChangeSheetAttendanceSource,
  uniquePaperAbsents,
  type ChangeSheetAttendanceSource,
  type PaperAbsentCamper,
  type PaperAttendanceListKind,
} from "@/lib/paperAttendance";

const TABLE = "transport_paper_attendance" as "profiles";

type PaperAttendanceRow = {
  list_kind: PaperAttendanceListKind;
  sheet_label: string;
  absents: unknown;
};

function parseAbsents(raw: unknown, sheetLabel: string): PaperAbsentCamper[] {
  if (!Array.isArray(raw)) return [];
  const rows: PaperAbsentCamper[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const camperName = String(rec.camperName ?? "").trim();
    if (!camperName) continue;
    rows.push({
      camperId: rec.camperId != null ? String(rec.camperId) : null,
      camperName,
      sheetLabel: String(rec.sheetLabel ?? sheetLabel).trim() || sheetLabel,
    });
  }
  return uniquePaperAbsents(rows);
}

export async function loadPaperAttendance(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  attendanceDate: string,
): Promise<{ bus: PaperAbsentCamper[]; group: PaperAbsentCamper[] }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("list_kind, sheet_label, absents")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("attendance_date", attendanceDate);

  if (error) {
    console.error("[PaperAttendance] load failed:", error.message);
    return { bus: [], group: [] };
  }

  const bus: PaperAbsentCamper[] = [];
  const group: PaperAbsentCamper[] = [];
  for (const row of (data ?? []) as PaperAttendanceRow[]) {
    const absents = parseAbsents(row.absents, row.sheet_label);
    if (row.list_kind === "group") group.push(...absents);
    else bus.push(...absents);
  }
  return { bus: uniquePaperAbsents(bus), group: uniquePaperAbsents(group) };
}

export async function savePaperAttendanceSheet(
  supabase: SupabaseClient,
  options: {
    companyId: string;
    season: string;
    attendanceDate: string;
    listKind: PaperAttendanceListKind;
    sheetLabel: string;
    absents: PaperAbsentCamper[];
    userId?: string | null;
  },
): Promise<boolean> {
  const sheetLabel = options.sheetLabel.trim();
  const absents = uniquePaperAbsents(options.absents).map((row) => ({
    camperId: row.camperId ?? null,
    camperName: row.camperName,
    sheetLabel,
  }));

  const { error } = await supabase.from(TABLE).upsert({
    company_id: options.companyId,
    season: options.season,
    attendance_date: options.attendanceDate,
    list_kind: options.listKind,
    sheet_label: sheetLabel,
    run_period: "day",
    absents,
    updated_by: options.userId ?? null,
    updated_at: new Date().toISOString(),
  } as never);

  if (error) {
    console.error("[PaperAttendance] save failed:", error.message);
    return false;
  }
  return true;
}

export async function loadChangeSheetAttendanceSource(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<ChangeSheetAttendanceSource> {
  const { data, error } = await supabase
    .from("transport_boards")
    .select("data")
    .eq("company_id", companyId)
    .eq("season", season)
    .maybeSingle();
  if (error) {
    console.error("[PaperAttendance] load source failed:", error.message);
    return "paperless";
  }
  const settings = (data?.data as { settings?: { changeSheetAttendanceSource?: unknown } } | null)?.settings;
  return parseChangeSheetAttendanceSource(settings?.changeSheetAttendanceSource);
}

export async function saveChangeSheetAttendanceSource(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  source: ChangeSheetAttendanceSource,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("transport_boards")
    .select("data")
    .eq("company_id", companyId)
    .eq("season", season)
    .maybeSingle();
  if (error) {
    console.error("[PaperAttendance] save source failed:", error.message);
    return false;
  }
  const current =
    data?.data && typeof data.data === "object" && !Array.isArray(data.data)
      ? (data.data as Record<string, unknown>)
      : null;
  if (!current) return false;
  const settings =
    current.settings && typeof current.settings === "object" && !Array.isArray(current.settings)
      ? { ...(current.settings as Record<string, unknown>) }
      : {};
  settings.changeSheetAttendanceSource = source;
  const { error: updateError } = await supabase
    .from("transport_boards")
    .update({ data: { ...current, settings } as never })
    .eq("company_id", companyId)
    .eq("season", season);
  if (updateError) {
    console.error("[PaperAttendance] save source failed:", updateError.message);
    return false;
  }
  return true;
}
