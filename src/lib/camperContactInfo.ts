import type { SupabaseClient } from "@supabase/supabase-js";

export type CamperContactDisplay = {
  guardianName: string | null;
  guardianNameP2: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  emergencyContact: string | null;
  familyName: string | null;
  authorizedPickups: Array<{
    fullName: string;
    relationship: string | null;
    phone: string | null;
    email: string | null;
  }>;
};

type ChildContactFields = {
  guardian_name?: string | null;
  guardian_name_p2?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  emergency_contact?: string | null;
};

type FamilyContactRow = {
  id: string;
  family_name: string;
  primary_contact_name: string | null;
  email: string | null;
  phone: string | null;
};

type AuthorizedPickupRow = {
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
};

export function mergeCamperContact(
  child: ChildContactFields,
  family: FamilyContactRow | null,
  authorizedPickups: AuthorizedPickupRow[] = [],
): CamperContactDisplay {
  return {
    guardianName: child.guardian_name || family?.primary_contact_name || null,
    guardianNameP2: child.guardian_name_p2 ?? null,
    guardianEmail: child.guardian_email || family?.email || null,
    guardianPhone: child.guardian_phone || family?.phone || null,
    emergencyContact: child.emergency_contact ?? null,
    familyName: family?.family_name ?? null,
    authorizedPickups: authorizedPickups.map((p) => ({
      fullName: p.full_name,
      relationship: p.relationship,
      phone: p.phone,
      email: p.email,
    })),
  };
}

export function hasCamperContactInfo(contact: CamperContactDisplay): boolean {
  return (
    !!contact.guardianName ||
    !!contact.guardianNameP2 ||
    !!contact.guardianEmail ||
    !!contact.guardianPhone ||
    !!contact.emergencyContact ||
    !!contact.familyName ||
    contact.authorizedPickups.length > 0
  );
}

/** Load parent-portal family + authorized pickups linked to a camper. */
export async function fetchCamperFamilyContact(
  supabase: SupabaseClient,
  childId: string,
): Promise<{ family: FamilyContactRow | null; authorizedPickups: AuthorizedPickupRow[] }> {
  const { data: linkRows } = await supabase
    .from("family_children")
    .select(
      "family_id, families:family_id(id, family_name, primary_contact_name, email, phone)",
    )
    .eq("child_id", childId)
    .limit(1);

  const family = (linkRows?.[0]?.families as FamilyContactRow | null) ?? null;

  const pickupQueries: Promise<{ data: AuthorizedPickupRow[] | null }>[] = [
    supabase
      .from("authorized_pickups")
      .select("full_name, relationship, phone, email")
      .eq("camper_id", childId)
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => ({ data: data as AuthorizedPickupRow[] | null })),
  ];

  if (family?.id) {
    pickupQueries.push(
      supabase
        .from("authorized_pickups")
        .select("full_name, relationship, phone, email")
        .eq("family_id", family.id)
        .is("camper_id", null)
        .eq("is_active", true)
        .order("full_name")
        .then(({ data }) => ({ data: data as AuthorizedPickupRow[] | null })),
    );
  }

  const pickupResults = await Promise.all(pickupQueries);
  const seen = new Set<string>();
  const authorizedPickups: AuthorizedPickupRow[] = [];
  for (const result of pickupResults) {
    for (const row of result.data ?? []) {
      const key = `${row.full_name}|${row.phone ?? ""}|${row.email ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      authorizedPickups.push(row);
    }
  }

  return { family, authorizedPickups };
}
