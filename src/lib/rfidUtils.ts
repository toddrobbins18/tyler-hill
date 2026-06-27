import { supabase } from "@/integrations/supabase/client";

/** Normalize scanner / manual RFID input (trailing newlines from Bluetooth wedge). */
export function normalizeRfidInput(raw: string): string {
  return raw.replace(/\u0000/g, "").trim().replace(/\r\n/g, "").replace(/\n/g, "").replace(/\r/g, "");
}

type RfidPerson = { id: string; name: string };

async function lookupByRfid(
  table: "children" | "staff",
  rfid: string,
  companyId: string,
  season: string,
  options?: { requireActiveStaff?: boolean },
): Promise<RfidPerson | null> {
  const normalized = normalizeRfidInput(rfid);
  if (!normalized || !companyId || !season) return null;

  const baseSelect = "id, name";
  const runQuery = async (match: "eq" | "ilike") => {
    let query = supabase
      .from(table)
      .select(baseSelect)
      .eq("company_id", companyId)
      .eq("season", season)
      .limit(1);

    if (table === "children") {
      query = query.neq("status", "inactive");
    } else if (options?.requireActiveStaff) {
      query = query.or("status.eq.active,status.is.null");
    }

    query = match === "eq" ? query.eq("rfid", normalized) : query.ilike("rfid", normalized);
    const { data, error } = await query;
    if (error) return null;
    return (data?.[0] as RfidPerson | undefined) ?? null;
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
