/** Merge camper guardian fields with parent-portal family + authorized pickup contacts. */

import type { SupabaseClient } from "@supabase/supabase-js";

export type CamperContactDisplay = {
  familyName?: string | null;
  guardianName?: string | null;
  guardianNameP2?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  emergencyContact?: string | null;
  authorizedPickups: Array<{
    fullName: string;
    relationship?: string | null;
    phone?: string | null;
    email?: string | null;
  }>;
};

type FamilyRow = {
  family_name: string;
  primary_contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AuthorizedPickupRow = {
  full_name: string;
  relationship?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active?: boolean | null;
  camper_id?: string | null;
};

export type CamperRow = {
  guardian_name?: string | null;
  guardian_name_p2?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  emergency_contact?: string | null;
};

export type CamperContactChild = CamperRow & {
  id: string;
  person_id?: string | null;
  company_id?: string;
  season?: string;
};

const GUARDIAN_FIELDS = [
  "guardian_name",
  "guardian_name_p2",
  "guardian_email",
  "guardian_phone",
  "emergency_contact",
] as const satisfies ReadonlyArray<keyof CamperRow>;

function trimOrNull(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

function normalizeEmail(value?: string | null): string | null {
  const trimmed = trimOrNull(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

export function mergeGuardianFields(primary: CamperRow, ...fallbacks: CamperRow[]): CamperRow {
  const result: CamperRow = { ...primary };

  for (const key of GUARDIAN_FIELDS) {
    if (trimOrNull(result[key])) continue;
    for (const fallback of fallbacks) {
      const value = trimOrNull(fallback[key]);
      if (value) {
        result[key] = value;
        break;
      }
    }
  }

  return result;
}

async function fetchSiblingChildIds(
  supabase: SupabaseClient,
  child: CamperContactChild,
): Promise<string[]> {
  if (!child.person_id || !child.company_id) return [child.id];

  const { data } = await supabase
    .from("children")
    .select("id")
    .eq("person_id", child.person_id)
    .eq("company_id", child.company_id);

  const ids = new Set<string>([child.id]);
  for (const row of data ?? []) {
    if (row.id) ids.add(row.id);
  }
  return [...ids];
}

async function fetchGuardianHistory(
  supabase: SupabaseClient,
  child: CamperContactChild,
): Promise<CamperRow[]> {
  if (!child.person_id || !child.company_id) return [];

  const { data } = await supabase
    .from("children")
    .select(
      "id, season, guardian_name, guardian_name_p2, guardian_email, guardian_phone, emergency_contact",
    )
    .eq("person_id", child.person_id)
    .eq("company_id", child.company_id)
    .order("season", { ascending: false });

  return (data ?? [])
    .filter((row) => row.id !== child.id)
    .map((row) => ({
      guardian_name: row.guardian_name,
      guardian_name_p2: row.guardian_name_p2,
      guardian_email: row.guardian_email,
      guardian_phone: row.guardian_phone,
      emergency_contact: row.emergency_contact,
    }));
}

async function fetchFamilyByEmail(
  supabase: SupabaseClient,
  companyId: string,
  email: string | null,
): Promise<FamilyRow | null> {
  if (!email) return null;

  const { data } = await supabase
    .from("families")
    .select("family_name, primary_contact_name, email, phone")
    .eq("company_id", companyId)
    .ilike("email", email)
    .order("created_at", { ascending: true })
    .limit(1);

  return (data?.[0] as FamilyRow | undefined) ?? null;
}

async function fetchFamilyLinkForChildIds(
  supabase: SupabaseClient,
  childIds: string[],
  preferredChildId: string,
): Promise<{ family: FamilyRow | null; familyId: string | null }> {
  if (childIds.length === 0) {
    return { family: null, familyId: null };
  }

  const { data: links } = await supabase
    .from("family_children")
    .select("family_id, child_id, created_at, families:family_id(family_name, primary_contact_name, email, phone)")
    .in("child_id", childIds)
    .order("created_at", { ascending: true });

  if (!links?.length) {
    return { family: null, familyId: null };
  }

  const preferred =
    links.find((link) => link.child_id === preferredChildId) ??
    links[0];

  const row = preferred as {
    family_id?: string;
    families?: FamilyRow | FamilyRow[] | null;
  };

  const familyRaw = row.families;
  const family = Array.isArray(familyRaw) ? familyRaw[0] ?? null : familyRaw ?? null;

  return { family, familyId: row.family_id ?? null };
}

export async function fetchCamperFamilyContact(
  supabase: { from: (table: string) => any },
  childId: string,
): Promise<{ family: FamilyRow | null; authorizedPickups: AuthorizedPickupRow[] }> {
  const { family, familyId } = await fetchFamilyLinkForChildIds(
    supabase as SupabaseClient,
    [childId],
    childId,
  );

  if (!familyId) {
    return { family: null, authorizedPickups: [] };
  }

  const { data: pickups } = await supabase
    .from("authorized_pickups")
    .select("full_name, relationship, phone, email, is_active, camper_id")
    .eq("family_id", familyId)
    .eq("is_active", true);

  const authorizedPickups = (pickups ?? []).filter(
    (pickup: AuthorizedPickupRow) => !pickup.camper_id || pickup.camper_id === childId,
  );

  return { family, authorizedPickups };
}

export function mergeCamperContact(
  child: CamperRow,
  family: FamilyRow | null,
  authorizedPickups: AuthorizedPickupRow[],
): CamperContactDisplay {
  return {
    familyName: trimOrNull(family?.family_name),
    guardianName: trimOrNull(child.guardian_name) ?? trimOrNull(family?.primary_contact_name),
    guardianNameP2: trimOrNull(child.guardian_name_p2),
    guardianEmail: trimOrNull(child.guardian_email) ?? trimOrNull(family?.email),
    guardianPhone: trimOrNull(child.guardian_phone) ?? trimOrNull(family?.phone),
    emergencyContact: trimOrNull(child.emergency_contact),
    authorizedPickups: authorizedPickups.map((pickup) => ({
      fullName: pickup.full_name,
      relationship: trimOrNull(pickup.relationship),
      phone: trimOrNull(pickup.phone),
      email: trimOrNull(pickup.email),
    })),
  };
}

export async function resolveCamperContactInfo(
  supabase: SupabaseClient,
  child: CamperContactChild,
): Promise<CamperContactDisplay> {
  const siblingChildIds = await fetchSiblingChildIds(supabase, child);
  const guardianHistory = await fetchGuardianHistory(supabase, child);
  const mergedChild = mergeGuardianFields(child, ...guardianHistory);

  let { family, familyId } = await fetchFamilyLinkForChildIds(
    supabase,
    siblingChildIds,
    child.id,
  );

  if (!family && child.company_id) {
    const email = normalizeEmail(mergedChild.guardian_email);
    family = await fetchFamilyByEmail(supabase, child.company_id, email);
    if (family) {
      const { data: familyRow } = await supabase
        .from("families")
        .select("id")
        .eq("company_id", child.company_id)
        .ilike("email", email ?? "")
        .limit(1)
        .maybeSingle();
      familyId = familyRow?.id ?? null;
    }
  }

  let authorizedPickups: AuthorizedPickupRow[] = [];
  if (familyId) {
    const { data: pickups } = await supabase
      .from("authorized_pickups")
      .select("full_name, relationship, phone, email, is_active, camper_id")
      .eq("family_id", familyId)
      .eq("is_active", true);

    const siblingIdSet = new Set(siblingChildIds);
    authorizedPickups = (pickups ?? []).filter(
      (pickup: AuthorizedPickupRow) =>
        !pickup.camper_id || siblingIdSet.has(pickup.camper_id),
    );
  }

  return mergeCamperContact(mergedChild, family, authorizedPickups);
}

export function hasCamperContactInfo(info: CamperContactDisplay): boolean {
  return !!(
    trimOrNull(info.familyName) ||
    trimOrNull(info.guardianName) ||
    trimOrNull(info.guardianNameP2) ||
    trimOrNull(info.guardianEmail) ||
    trimOrNull(info.guardianPhone) ||
    trimOrNull(info.emergencyContact) ||
    info.authorizedPickups.length > 0
  );
}
