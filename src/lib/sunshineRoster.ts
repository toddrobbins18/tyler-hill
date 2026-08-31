import { supabase } from "@/integrations/supabase/client";
import { filterActiveRoster } from "@/lib/rosterStatus";
import {
  canonicalSunshineGroupName,
  isNorthShoreSunshineGroup,
  NORTH_SHORE_SUNSHINE_GROUP_NAMES,
  sunshineGroupSortOrder,
} from "@/lib/sunshineGroups";

type RosterChild = {
  id: string;
  name: string;
  group_name: string | null;
  guardian_email: string | null;
  status: string | null;
};

export type SunshineRosterSyncResult = {
  groups: number;
  campers: number;
  skippedNoGroup: number;
};

const normalizeGroupName = (value: string) => value.trim().toLowerCase();

/** Sync sunshine_groups + sunshine_campers from Nest roster (children.group_name = FULLSUMMERGROUP). */
export async function syncSunshineFromRoster(
  companyId: string,
  season: string,
  options?: { northShoreSunshineOnly?: boolean },
): Promise<SunshineRosterSyncResult> {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, group_name, guardian_email, status")
    .eq("company_id", companyId)
    .eq("season", season)
    .order("name");

  if (error) throw error;

  const roster = filterActiveRoster(data as RosterChild[] | null);
  const northShoreOnly = options?.northShoreSunshineOnly === true;

  const eligible = northShoreOnly
    ? roster.filter((c) => isNorthShoreSunshineGroup(c.group_name))
    : roster.filter((c) => c.group_name?.trim());

  const withGroup = eligible;
  const skippedNoGroup = roster.length - withGroup.length;

  const groupNames = northShoreOnly
    ? [...NORTH_SHORE_SUNSHINE_GROUP_NAMES]
    : [...new Set(withGroup.map((c) => c.group_name!.trim()))].sort((a, b) =>
        a.localeCompare(b),
      );

  const { data: existingGroups, error: groupsError } = await supabase
    .from("sunshine_groups")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("season", season);

  if (groupsError) throw groupsError;

  const groupIdByName = new Map<string, string>();
  for (const group of existingGroups || []) {
    groupIdByName.set(normalizeGroupName(group.name), group.id);
  }

  for (let i = 0; i < groupNames.length; i++) {
    const name = groupNames[i];
    const key = normalizeGroupName(name);
    if (groupIdByName.has(key)) continue;

    const { data: inserted, error: insertError } = await supabase
      .from("sunshine_groups")
      .insert({
        company_id: companyId,
        name,
        sort_order: northShoreOnly ? sunshineGroupSortOrder(name) : i,
        season,
      })
      .select("id, name")
      .single();

    if (insertError?.code === "23505") {
      const { data: duplicate } = await supabase
        .from("sunshine_groups")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("season", season)
        .ilike("name", name)
        .maybeSingle();
      if (duplicate) groupIdByName.set(key, duplicate.id);
      continue;
    }
    if (insertError) throw insertError;
    if (inserted) groupIdByName.set(key, inserted.id);
  }

  const sortByGroup = new Map<string, number>();
  const camperPayload: Array<{
    company_id: string;
    child_id: string;
    full_name: string;
    parent_email: string | null;
    group_id: string;
    sort_order: number;
    season: string;
  }> = [];

  for (const child of withGroup) {
    const groupName = northShoreOnly
      ? canonicalSunshineGroupName(child.group_name!.trim())
      : child.group_name!.trim();
    if (!groupName) continue;

    const groupId = groupIdByName.get(normalizeGroupName(groupName));
    if (!groupId) continue;

    const sortOrder = (sortByGroup.get(groupId) ?? 0) + 1;
    sortByGroup.set(groupId, sortOrder);

    camperPayload.push({
      company_id: companyId,
      child_id: child.id,
      full_name: child.name,
      parent_email: child.guardian_email?.trim() || null,
      group_id: groupId,
      sort_order: sortOrder,
      season,
    });
  }

  // Replace season roster (avoids upsert — prod may lack unique index on company_id,season,child_id)
  const { error: deleteError } = await supabase
    .from("sunshine_campers")
    .delete()
    .eq("company_id", companyId)
    .eq("season", season);
  if (deleteError) throw deleteError;

  const BATCH = 100;
  for (let i = 0; i < camperPayload.length; i += BATCH) {
    const batch = camperPayload.slice(i, i + BATCH);
    const { error: insertError } = await supabase.from("sunshine_campers").insert(batch);
    if (insertError) throw insertError;
  }

  return {
    groups: groupNames.length,
    campers: camperPayload.length,
    skippedNoGroup,
  };
}
