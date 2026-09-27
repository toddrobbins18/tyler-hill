import { normCamperNameKey } from "@/lib/routeReferenceWarehouse";
import { buildMappoint2026AddressHints } from "@/lib/transportRoster";
import { fetchActiveRosterChildren, type ActiveRosterChildRow } from "@/lib/rosterChildren";
import { filterActiveRoster } from "@/lib/rosterStatus";
import type { OptCamper } from "@/lib/bunking-optimizer";

export type BunkingRosterChildRow = ActiveRosterChildRow;

function cityFromAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2];
  return "";
}

function buildTownLookup(): Map<string, string> {
  const hints = buildMappoint2026AddressHints();
  const towns = new Map<string, string>();
  for (const [nameKey, hint] of hints) {
    const city = cityFromAddress(hint.address);
    if (city) towns.set(nameKey, city);
  }
  return towns;
}

/** Map a roster row to bunking optimizer input (exported for tests). */
export function mapBunkingRosterChild(
  child: BunkingRosterChildRow,
  townByName?: Map<string, string>,
): OptCamper {
  const nameKey = normCamperNameKey(child.name);
  return {
    id: child.id,
    name: child.name,
    gender: child.gender || undefined,
    division:
      child.division?.name?.trim() ||
      child.grade?.trim() ||
      child.group_name?.trim() ||
      "",
    town: townByName?.get(nameKey) || "",
    requests: [],
    disrequests: [],
  };
}

/** Load all active enrolled campers from Nest roster for bunking boards. */
export async function fetchBunkingCampersFromRoster(
  companyId: string,
  season: string,
): Promise<OptCamper[]> {
  const rows = await fetchActiveRosterChildren(companyId, season);
  const townByName = buildTownLookup();
  return filterActiveRoster(rows).map((child) => mapBunkingRosterChild(child, townByName));
}
