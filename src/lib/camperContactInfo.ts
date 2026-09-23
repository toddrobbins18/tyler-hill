/** Merge camper guardian fields with parent-portal family + authorized pickup contacts. */

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

type CamperRow = {
  guardian_name?: string | null;
  guardian_name_p2?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  emergency_contact?: string | null;
};

function trimOrNull(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

export async function fetchCamperFamilyContact(
  supabase: { from: (table: string) => any },
  childId: string,
): Promise<{ family: FamilyRow | null; authorizedPickups: AuthorizedPickupRow[] }> {
  const { data: link } = await supabase
    .from("family_children")
    .select("family_id, families:family_id(family_name, primary_contact_name, email, phone)")
    .eq("child_id", childId)
    .maybeSingle();

  const row = link as {
    family_id?: string;
    families?: FamilyRow | FamilyRow[] | null;
  } | null;

  const familyRaw = row?.families;
  const family = Array.isArray(familyRaw) ? familyRaw[0] ?? null : familyRaw ?? null;

  if (!row?.family_id) {
    return { family: null, authorizedPickups: [] };
  }

  const { data: pickups } = await supabase
    .from("authorized_pickups")
    .select("full_name, relationship, phone, email, is_active, camper_id")
    .eq("family_id", row.family_id)
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
