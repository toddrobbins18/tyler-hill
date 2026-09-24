import type { SupabaseClient } from "@supabase/supabase-js";
import { campTodayDateString } from "@/lib/parentPortalCutoff";
import { normalizeRfidInput, lookupStaffByRfid } from "@/lib/rfidUtils";
import {
  STAFF_QR_PREFIX,
  parseStaffQrPayload,
  staffQrPayload,
} from "@/lib/staffQrCode";

export type StaffTimeClockMethod = "qr" | "rfid" | "manual";
export type StaffTimeClockSignOutMethod = StaffTimeClockMethod | "auto";

export type StaffTimeClockRow = {
  id: string;
  company_id: string;
  season: string;
  staff_id: string;
  work_date: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
  sign_in_method: StaffTimeClockMethod | null;
  sign_out_method: StaffTimeClockSignOutMethod | null;
  auto_signed_out: boolean;
};

export type StaffTimeClockPunchResult =
  | { ok: true; action: "in" | "out"; staffName: string; at: string; row: StaffTimeClockRow }
  | { ok: false; message: string };

export function staffTimeClockWorkDate(now = new Date()): string {
  return campTodayDateString(now);
}

export async function lookupStaffByQrToken(
  supabase: SupabaseClient,
  token: string,
  companyId: string,
  season: string,
): Promise<{ id: string; name: string; qr_token: string | null } | null> {
  const normalized = token.trim();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("staff")
    .select("id, name, qr_token")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("qr_token", normalized)
    .neq("status", "inactive")
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: string; name: string; qr_token: string | null };
}

export async function ensureStaffQrToken(
  supabase: SupabaseClient,
  staffId: string,
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("staff")
    .select("id, qr_token")
    .eq("id", staffId)
    .maybeSingle();

  if (error || !row) return null;
  if (row.qr_token) return row.qr_token as string;

  const token = crypto.randomUUID().replace(/-/g, "");
  const { error: updateError } = await supabase
    .from("staff")
    .update({ qr_token: token })
    .eq("id", staffId);

  if (updateError) return null;
  return token;
}

async function resolveStaffFromScan(
  supabase: SupabaseClient,
  rawScan: string,
  companyId: string,
  season: string,
): Promise<{ id: string; name: string; method: StaffTimeClockMethod } | null> {
  const trimmed = rawScan.trim();
  if (!trimmed) return null;

  const qrToken = parseStaffQrPayload(trimmed);
  if (qrToken) {
    const staff = await lookupStaffByQrToken(supabase, qrToken, companyId, season);
    if (staff) return { id: staff.id, name: staff.name, method: "qr" };
  }

  const rfid = normalizeRfidInput(trimmed);
  const byRfid = await lookupStaffByRfid(rfid, companyId, season);
  if (byRfid) return { id: byRfid.id, name: byRfid.name, method: "rfid" };

  return null;
}

export async function processStaffTimeClockScan(
  supabase: SupabaseClient,
  options: {
    rawScan: string;
    companyId: string;
    season: string;
    userId?: string | null;
    workDate?: string;
  },
): Promise<StaffTimeClockPunchResult> {
  const workDate = options.workDate ?? staffTimeClockWorkDate();
  const staff = await resolveStaffFromScan(
    supabase,
    options.rawScan,
    options.companyId,
    options.season,
  );

  if (!staff) {
    return { ok: false, message: "Staff badge not recognized" };
  }

  const { data: existing, error: loadError } = await supabase
    .from("staff_time_clock")
    .select("*")
    .eq("company_id", options.companyId)
    .eq("season", options.season)
    .eq("staff_id", staff.id)
    .eq("work_date", workDate)
    .maybeSingle();

  if (loadError) {
    return { ok: false, message: loadError.message };
  }

  const nowIso = new Date().toISOString();
  const row = existing as StaffTimeClockRow | null;

  if (!row?.signed_in_at) {
    const payload = {
      company_id: options.companyId,
      season: options.season,
      staff_id: staff.id,
      work_date: workDate,
      signed_in_at: nowIso,
      sign_in_method: staff.method,
      signed_in_by: options.userId ?? null,
      updated_at: nowIso,
    };

    const { data: inserted, error } = row
      ? await supabase.from("staff_time_clock").update(payload).eq("id", row.id).select("*").single()
      : await supabase.from("staff_time_clock").insert(payload).select("*").single();

    if (error || !inserted) {
      return { ok: false, message: error?.message ?? "Sign in failed" };
    }

    return {
      ok: true,
      action: "in",
      staffName: staff.name,
      at: nowIso,
      row: inserted as StaffTimeClockRow,
    };
  }

  if (!row.signed_out_at) {
    const { data: updated, error } = await supabase
      .from("staff_time_clock")
      .update({
        signed_out_at: nowIso,
        sign_out_method: staff.method,
        signed_out_by: options.userId ?? null,
        updated_at: nowIso,
      })
      .eq("id", row.id)
      .select("*")
      .single();

    if (error || !updated) {
      return { ok: false, message: error?.message ?? "Sign out failed" };
    }

    return {
      ok: true,
      action: "out",
      staffName: staff.name,
      at: nowIso,
      row: updated as StaffTimeClockRow,
    };
  }

  return {
    ok: false,
    message: `${staff.name} already signed in and out for today`,
  };
}

export async function loadStaffTimeClockForDate(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  workDate: string,
): Promise<(StaffTimeClockRow & { staff?: { name: string } })[]> {
  const { data, error } = await supabase
    .from("staff_time_clock")
    .select("*, staff:staff_id(name)")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("work_date", workDate)
    .order("signed_in_at", { ascending: false });

  if (error) {
    console.error("[StaffTimeClock] load failed:", error.message);
    return [];
  }

  return (data ?? []) as (StaffTimeClockRow & { staff?: { name: string } })[];
}

export function staffQrScanHint(token: string): string {
  return staffQrPayload(token);
}
