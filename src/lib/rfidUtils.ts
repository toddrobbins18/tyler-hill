import { supabase } from "@/integrations/supabase/client";

/** Normalize scanner / manual RFID input (trailing newlines from Bluetooth wedge). */
export function normalizeRfidInput(raw: string): string {
  return raw.replace(/\u0000/g, "").trim().replace(/\r\n/g, "").replace(/\n/g, "").replace(/\r/g, "");
}

export function rfidsMatch(
  stored: string | null | undefined,
  scanned: string | null | undefined,
): boolean {
  const a = normalizeRfidInput(stored ?? "");
  const b = normalizeRfidInput(scanned ?? "");
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function findInListByRfid<T extends { rfid?: string | null }>(
  list: T[],
  scanned: string,
): T | undefined {
  return list.find((item) => rfidsMatch(item.rfid, scanned));
}

type RfidPerson = { id: string; name: string; rfid?: string | null };

async function lookupByRfid<T extends RfidPerson>(
  table: "children" | "staff",
  rfid: string,
  companyId: string,
  season: string,
  options?: { requireActiveStaff?: boolean; select?: string },
): Promise<T | null> {
  const normalized = normalizeRfidInput(rfid);
  if (!normalized || !companyId || !season) return null;

  const select = options?.select ?? "id, name, rfid";
  const runQuery = async (match: "eq" | "ilike") => {
    let query = supabase
      .from(table)
      .select(select)
      .eq("company_id", companyId)
      .eq("season", season)
      .limit(1);

    if (table === "children") {
      query = query.neq("status", "inactive");
    } else if (options?.requireActiveStaff) {
      query = query.or("status.eq.active,status.is.null");
    } else {
      query = query.neq("status", "inactive");
    }

    query = match === "eq" ? query.eq("rfid", normalized) : query.ilike("rfid", normalized);
    const { data, error } = await query;
    if (error) return null;
    return (data?.[0] as T | undefined) ?? null;
  };

  return (await runQuery("eq")) ?? (await runQuery("ilike"));
}

export async function lookupChildByRfid(
  rfid: string,
  companyId: string,
  season: string,
): Promise<RfidPerson | null> {
  return lookupByRfid("children", rfid, companyId, season);
}

export async function lookupStaffByRfid(
  rfid: string,
  companyId: string,
  season: string,
  options?: { requireActiveStaff?: boolean },
): Promise<RfidPerson | null> {
  return lookupByRfid("staff", rfid, companyId, season, options);
}

export async function lookupCamperOrStaffByRfid(
  rfid: string,
  companyId: string,
  season: string,
): Promise<{ entity: RfidPerson; isStaff: boolean } | null> {
  const child = await lookupChildByRfid(rfid, companyId, season);
  if (child) return { entity: child, isStaff: false };

  const staff = await lookupStaffByRfid(rfid, companyId, season, { requireActiveStaff: true });
  if (staff) return { entity: staff, isStaff: true };

  return null;
}

export type OwlPayCamperRfidMatch = {
  id: string;
  name: string;
  rfid: string | null;
  photo_url: string | null;
  owl_pay_balance: number | null;
  person_id: string | null;
};

export type OwlPayStaffRfidMatch = {
  id: string;
  name: string;
  rfid: string | null;
  photo_url: string | null;
};

export async function lookupOwlPayCamperByRfid(
  rfid: string,
  companyId: string,
  season: string,
): Promise<OwlPayCamperRfidMatch | null> {
  return lookupByRfid<OwlPayCamperRfidMatch>(
    "children",
    rfid,
    companyId,
    season,
    { select: "id, name, rfid, photo_url, owl_pay_balance, person_id" },
  );
}

export async function lookupOwlPayStaffByRfid(
  rfid: string,
  companyId: string,
  season: string,
): Promise<OwlPayStaffRfidMatch | null> {
  return lookupByRfid<OwlPayStaffRfidMatch>(
    "staff",
    rfid,
    companyId,
    season,
    { select: "id, name, rfid, photo_url" },
  );
}
