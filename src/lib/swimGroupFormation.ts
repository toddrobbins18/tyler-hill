import type { SupabaseClient } from "@supabase/supabase-js";
import { compareByLastName } from "@/lib/nameSortUtils";
import { filterActiveRoster } from "@/lib/rosterStatus";
import {
  type LevelRecord,
  levelFromChild,
  loadSwimSavedRecords,
  rosterDivisionLeader,
  rosterGroup,
  type RosterChild,
} from "@/lib/swimProgram";

export type SwimFormationCriterion = "division" | "group" | "swimLevel" | "divisionLeader";

export const SWIM_FORMATION_CRITERIA: {
  id: SwimFormationCriterion;
  label: string;
  description: string;
}[] = [
  {
    id: "division",
    label: "Division",
    description: "Keep campers in the same camp division together",
  },
  {
    id: "divisionLeader",
    label: "Division leader",
    description: "Never mix children from different division leaders in the same swim group",
  },
  {
    id: "group",
    label: "Camp group",
    description: "Keep campers in the same bunk / group together",
  },
  {
    id: "swimLevel",
    label: "Previous swim level complete",
    description: "Group by the highest swim level they have completed",
  },
];

export type SwimFormationCamper = {
  id: string;
  name: string;
  personId: string;
  division: string;
  group: string;
  divisionLeader: string;
  highestCompletedLevel: string;
};

export type SwimFormationSettings = {
  criteria: SwimFormationCriterion[];
  /** Number of instructors — splits each cohort into balanced groups (~equal campers each). */
  instructorCount: number;
};

export type SwimFormationGroup = {
  id: string;
  label: string;
  keyParts: string[];
  campers: SwimFormationCamper[];
};

const LEVEL_COMPLETE_CHECKS: { label: string; isComplete: (l: LevelRecord) => boolean }[] = [
  { label: "Goldfish", isComplete: (l) => l.goldfishLevel === "Complete" },
  { label: "Minnow", isComplete: (l) => l.minnowLevel === "Complete" },
  { label: "Tadpole", isComplete: (l) => l.tadpoleLevel === "Complete" },
  { label: "Red Cross I", isComplete: (l) => l.redCross === "Complete" },
  { label: "Red Cross II", isComplete: (l) => l.redCross2 === "Complete" },
  { label: "Red Cross III", isComplete: (l) => l.redCross3 === "Complete" },
  { label: "Red Cross IV", isComplete: (l) => l.redCross4 === "Complete" },
  { label: "Frog", isComplete: (l) => l.frog === "Complete" },
];

/** Highest completed swim level name, or a friendly fallback. */
export function highestCompletedSwimLevel(level: LevelRecord | null | undefined): string {
  if (!level) return "No level recorded";
  let highest = "No level complete yet";
  for (const step of LEVEL_COMPLETE_CHECKS) {
    if (step.isComplete(level)) highest = step.label;
  }
  return highest;
}

/** Split campers into N balanced groups for N instructors (sizes differ by at most 1). */
export function splitBalancedByInstructors<T>(items: T[], instructorCount: number): T[][] {
  if (items.length === 0) return [];
  const requested = Math.max(1, Math.min(20, Math.floor(instructorCount) || 1));
  const groupCount = Math.min(requested, items.length);
  const base = Math.floor(items.length / groupCount);
  const remainder = items.length % groupCount;
  const chunks: T[][] = [];
  let idx = 0;
  for (let g = 0; g < groupCount; g++) {
    const size = base + (g < remainder ? 1 : 0);
    if (size > 0) {
      chunks.push(items.slice(idx, idx + size));
      idx += size;
    }
  }
  return chunks;
}

function divisionLeaderKey(leader: string): string {
  const trimmed = leader.trim();
  return trimmed || "No division leader";
}

function partitionByDivisionLeader(
  campers: SwimFormationCamper[],
): Map<string, SwimFormationCamper[]> {
  const map = new Map<string, SwimFormationCamper[]>();
  for (const camper of campers) {
    const key = divisionLeaderKey(camper.divisionLeader);
    const list = map.get(key) ?? [];
    list.push(camper);
    map.set(key, list);
  }
  return map;
}

function bucketKey(camper: SwimFormationCamper, criteria: SwimFormationCriterion[]): string {
  if (criteria.length === 0) return "all";
  return criteria
    .map((c) => {
      if (c === "division") return `div:${camper.division}`;
      if (c === "group") return `grp:${camper.group}`;
      if (c === "divisionLeader") return `ldr:${divisionLeaderKey(camper.divisionLeader)}`;
      return `lvl:${camper.highestCompletedLevel}`;
    })
    .join("|");
}

function bucketLabel(parts: string[]): string {
  return parts.join(" · ");
}

function labelPartsForCamper(
  camper: SwimFormationCamper,
  criteria: SwimFormationCriterion[],
): string[] {
  const parts: string[] = [];
  if (criteria.includes("division")) parts.push(camper.division);
  if (criteria.includes("divisionLeader")) parts.push(divisionLeaderKey(camper.divisionLeader));
  if (criteria.includes("group")) parts.push(camper.group);
  if (criteria.includes("swimLevel")) parts.push(camper.highestCompletedLevel);
  return parts.length ? parts : ["All campers"];
}

/** Build swim instruction groups from roster + selected criteria. */
export function buildSwimFormationGroups(
  campers: SwimFormationCamper[],
  settings: SwimFormationSettings,
): SwimFormationGroup[] {
  const instructorCount = Math.max(1, Math.min(20, Math.floor(settings.instructorCount) || 1));
  const criteria = settings.criteria;
  const sorted = [...campers].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const buckets = new Map<string, { labelParts: string[]; campers: SwimFormationCamper[] }>();

  for (const camper of sorted) {
    const key = bucketKey(camper, criteria);
    const existing = buckets.get(key);
    if (existing) {
      existing.campers.push(camper);
    } else {
      buckets.set(key, {
        labelParts: labelPartsForCamper(camper, criteria),
        campers: [camper],
      });
    }
  }

  const groups: SwimFormationGroup[] = [];
  let groupIndex = 0;

  const bucketList = [...buckets.entries()].sort((a, b) =>
    bucketLabel(a[1].labelParts).localeCompare(bucketLabel(b[1].labelParts)),
  );

  for (const [, bucket] of bucketList) {
    const leaderPartitions = partitionByDivisionLeader(bucket.campers);
    const leaderEntries = [...leaderPartitions.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (const [leaderName, leaderCampers] of leaderEntries) {
      const chunks = splitBalancedByInstructors(leaderCampers, instructorCount);
      const leaderInCriteria = criteria.includes("divisionLeader");
      const labelParts = leaderInCriteria ? bucket.labelParts : [...bucket.labelParts, leaderName];

      chunks.forEach((chunk, chunkIndex) => {
        groupIndex += 1;
        const suffix =
          chunks.length > 1
            ? ` (${chunkIndex + 1} of ${chunks.length} · ~${chunk.length} per instructor)`
            : "";
        groups.push({
          id: `group-${groupIndex}`,
          label: `${bucketLabel(labelParts)}${suffix}`,
          keyParts: labelParts,
          campers: chunk,
        });
      });
    }
  }

  return groups;
}

type FormationChildRow = RosterChild & {
  leader_id?: string | null;
  status?: string | null;
  division?: { name: string } | { name: string }[] | null;
};

function divisionNameFromRow(row: FormationChildRow): string {
  const d = row.division;
  if (!d) return "—";
  if (Array.isArray(d)) return d[0]?.name?.trim() || "—";
  return d.name?.trim() || "—";
}

/** Active campers with division, group, and swim level for group formation. */
export async function fetchSwimFormationCampers(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<SwimFormationCamper[]> {
  type Row = FormationChildRow;
  const rows: Row[] = [];
  let from = 0;
  const pageSize = 1000;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, person_id, group_name, season, leader_id, status, division:divisions(name)")
      .eq("company_id", companyId)
      .eq("season", season)
      .order("name")
      .range(from, to);

    if (error) throw error;
    const batch: Row[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      person_id: String(row.person_id ?? row.id),
      group_name: row.group_name,
      season: row.season,
      leader_id: row.leader_id,
      status: row.status,
      leader: null,
      division: row.division as FormationChildRow["division"],
    }));
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const children = filterActiveRoster(rows);
  const childById = new Map(children.map((c) => [c.id, c]));

  const leaderIds = [
    ...new Set(
      children
        .map((r) => (r as Row).leader_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (leaderIds.length) {
    const { data: leaders } = await supabase.from("staff").select("id, name").in("id", leaderIds);
    const leaderById = new Map((leaders ?? []).map((s) => [s.id, s.name]));
    for (const row of children) {
      const lid = (row as Row).leader_id;
      if (lid && leaderById.has(lid)) {
        row.leader = { name: leaderById.get(lid)! };
      }
    }
  }

  const { levels } = await loadSwimSavedRecords(supabase, companyId, season, childById);

  const campers: SwimFormationCamper[] = children.map((child) => {
    const level =
      levels.get(child.id) ??
      levelFromChild(child);
    return {
      id: child.id,
      name: child.name,
      personId: child.person_id,
      division: divisionNameFromRow(child as Row),
      group: rosterGroup(child),
      divisionLeader: rosterDivisionLeader(child),
      highestCompletedLevel: highestCompletedSwimLevel(level),
    };
  });

  campers.sort((a, b) => compareByLastName(a as RosterChild, b as RosterChild));
  return campers;
}
