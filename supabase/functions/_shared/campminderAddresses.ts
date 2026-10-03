/**
 * CampMinder home address resolution for campers.
 * Household addresses live on family records (GetFamilyAddresses), not always on person rows.
 */

const CM_ENTITY_FAMILY_BASES = [
  "https://api.campminder.com/entity/family",
  "https://webapi.campminder.com/api/entity/family",
];

export function normCamperNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Split MapPoint household rows into individual roster names.
 * e.g. "Aaron & Layla Weissler" → ["Aaron Weissler", "Layla Weissler"]
 */
export function expandMappointCamperNames(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (!trimmed.includes("&") && !trimmed.includes(",")) return [trimmed];

  const segments = trimmed
    .split(/\s*,\s*|\s*&\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length <= 1) return [trimmed];

  let sharedLastName = "";
  for (let i = segments.length - 1; i >= 0; i--) {
    const tokens = segments[i].split(/\s+/);
    if (tokens.length >= 2) {
      sharedLastName = tokens.slice(1).join(" ");
      break;
    }
  }

  const out: string[] = [];
  for (const segment of segments) {
    const tokens = segment.split(/\s+/);
    if (tokens.length >= 2) {
      out.push(segment);
    } else if (sharedLastName) {
      out.push(`${segment} ${sharedLastName}`);
    } else {
      out.push(segment);
    }
  }

  return [...new Set(out.map((name) => name.trim()))].filter(Boolean);
}

export type CmAddressParts = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

export function formatCmAddress(parts: CmAddressParts | null | undefined): string | null {
  if (!parts) return null;
  const line1 = parts.line1?.trim();
  if (!line1) return null;
  const street = [line1, parts.line2?.trim()].filter(Boolean).join(", ");
  const cityState = [parts.city?.trim(), parts.state?.trim()].filter(Boolean).join(", ");
  const cityStateZip = [cityState, parts.zip?.trim()].filter(Boolean).join(" ");
  return [street, cityStateZip].filter(Boolean).join(", ") || null;
}

function addressPartsFromRecord(raw: unknown): CmAddressParts | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const nested = o.Address && typeof o.Address === "object" ? (o.Address as Record<string, unknown>) : o;
  const line1 = nested.AddressLine1 ?? nested.Line1 ?? nested.Street1 ?? nested.Street ?? nested.addressLine1;
  if (line1 == null || String(line1).trim() === "") return null;
  return {
    line1: String(line1),
    line2: nested.AddressLine2 != null ? String(nested.AddressLine2) : nested.Line2 != null ? String(nested.Line2) : null,
    city: nested.City != null ? String(nested.City) : null,
    state: nested.StateProvince != null
      ? String(nested.StateProvince)
      : nested.State != null
      ? String(nested.State)
      : null,
    zip: nested.PostalCode != null
      ? String(nested.PostalCode)
      : nested.Zip != null
      ? String(nested.Zip)
      : null,
  };
}

function pickPreferredAddressEntry(entries: unknown[]): unknown | null {
  if (!entries.length) return null;
  const scored = entries.filter((e) => e && typeof e === "object") as Record<string, unknown>[];
  if (!scored.length) return null;
  const home = scored.find((e) => /home|primary|mail/i.test(String(e.Label ?? e.MailingTitle ?? "")));
  return home ?? scored[0];
}

/** Try person ContactDetails / top-level address fields. */
export function extractHomeAddressFromPerson(person: unknown): string | null {
  if (!person || typeof person !== "object") return null;
  const p = person as Record<string, unknown>;
  const contact = p.ContactDetails as Record<string, unknown> | undefined;

  const addressLists = [
    contact?.Addresses,
    contact?.addresses,
    p.Addresses,
  ].filter(Array.isArray) as unknown[][];

  for (const list of addressLists) {
    const picked = pickPreferredAddressEntry(list);
    const formatted = formatCmAddress(addressPartsFromRecord(picked));
    if (formatted) return formatted;
  }

  for (const candidate of [contact?.Address, contact?.HomeAddress, p.HomeAddress, p.Address]) {
    const formatted = formatCmAddress(addressPartsFromRecord(candidate));
    if (formatted) return formatted;
  }

  return null;
}

async function fetchEntityFamilyJson(
  path: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  query: Record<string, string | number | string[]>,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<any | null> {
  for (const base of CM_ENTITY_FAMILY_BASES) {
    await acquireRateLimitSlot();
    const params = new URLSearchParams();
    params.set("clientid", clientId);
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, String(v));
      } else {
        params.set(key, String(value));
      }
    }

    const url = `${base}/${path}?${params.toString()}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Ocp-Apim-Subscription-Key": subscriptionKey,
        },
      });
      if (!response.ok) {
        const text = await response.text();
        console.warn(`[Addresses] ${path} HTTP ${response.status}: ${text.slice(0, 160)}`);
        continue;
      }
      const payload = await response.json();
      if (payload?.Success === false) {
        console.warn(`[Addresses] ${path} Success=false: ${payload?.ErrorText || "unknown"}`);
        continue;
      }
      return payload;
    } catch (err) {
      console.warn(`[Addresses] ${path} error:`, err instanceof Error ? err.message : String(err));
    }
  }
  return null;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Resolve home address per camper person ID.
 * 1) Person ContactDetails (when present on /persons fetch)
 * 2) CampMinder family household address (GetFamilyPersons + GetFamilyAddresses)
 */
export async function loadHomeAddressesByPerson(
  personIds: string[],
  personMap: Map<string, unknown>,
  token: string,
  subscriptionKey: string,
  clientId: string,
  acquireRateLimitSlot: () => Promise<void>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!personIds.length) return result;

  for (const personId of personIds) {
    const key = String(personId);
    const fromPerson = extractHomeAddressFromPerson(personMap.get(key));
    if (fromPerson) result.set(key, fromPerson);
  }

  const missingIds = personIds.map(String).filter((id) => !result.has(id));
  if (!missingIds.length) return result;

  const personToFamily = new Map<string, number>();
  for (const batch of chunkArray(missingIds, 50)) {
    const numericIds = batch.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n));
    if (!numericIds.length) continue;

    const payload = await fetchEntityFamilyJson(
      "GetFamilyPersons",
      token,
      subscriptionKey,
      clientId,
      { PersonIDs: numericIds.map(String) },
      acquireRateLimitSlot,
    );
    const rows = Array.isArray(payload?.Result) ? payload.Result : [];
    for (const row of rows) {
      const personId = row?.PersonID != null ? String(row.PersonID) : "";
      const familyId = row?.FamilyID != null ? Number(row.FamilyID) : NaN;
      if (personId && Number.isFinite(familyId)) {
        personToFamily.set(personId, familyId);
      }
    }
  }

  const familyIds = [...new Set(personToFamily.values())];
  const familyAddress = new Map<number, string>();

  for (const batch of chunkArray(familyIds, 50)) {
    const payload = await fetchEntityFamilyJson(
      "GetFamilyAddresses",
      token,
      subscriptionKey,
      clientId,
      { FamilyIDs: batch.map(String) },
      acquireRateLimitSlot,
    );
    const dict = payload?.Result;
    if (!dict || typeof dict !== "object") continue;

    for (const [familyKey, entries] of Object.entries(dict as Record<string, unknown>)) {
      const familyId = Number(familyKey);
      if (!Number.isFinite(familyId)) continue;
      const list = Array.isArray(entries) ? entries : [];
      const picked = pickPreferredAddressEntry(list);
      const formatted = formatCmAddress(addressPartsFromRecord(picked));
      if (formatted) familyAddress.set(familyId, formatted);
    }
  }

  for (const [personId, familyId] of personToFamily) {
    if (result.has(personId)) continue;
    const addr = familyAddress.get(familyId);
    if (addr) result.set(personId, addr);
  }

  return result;
}

/** camper_name_key → formatted address from route_reference_assignments (2026 MapPoint priors). */
export async function loadRouteReferenceAddressHints(
  supabase: { from: (table: string) => any },
  companyId: string,
  referenceSeason = "2026",
): Promise<Map<string, string>> {
  const hints = new Map<string, string>();
  const { data, error } = await supabase
    .from("route_reference_assignments")
    .select("camper_name_key, camper_name, address")
    .eq("company_id", companyId)
    .eq("reference_season", referenceSeason);

  if (error) {
    console.warn("[Addresses] route_reference_assignments load failed:", error.message);
    return hints;
  }

  for (const row of data ?? []) {
    const address = String(row.address ?? "").trim();
    if (!address) continue;
    const keys = new Set<string>();
    if (row.camper_name_key) keys.add(normCamperNameKey(String(row.camper_name_key)));
    if (row.camper_name) {
      for (const expanded of expandMappointCamperNames(String(row.camper_name))) {
        keys.add(normCamperNameKey(expanded));
      }
    }
    for (const key of keys) {
      if (key && !hints.has(key)) hints.set(key, address);
    }
  }

  console.log(`[Addresses] Loaded ${hints.size} route-reference address hints for season ${referenceSeason}`);
  return hints;
}
