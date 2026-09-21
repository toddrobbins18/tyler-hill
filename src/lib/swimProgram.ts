import type { SupabaseClient } from "@supabase/supabase-js";
import { compareByLastName } from "@/lib/nameSortUtils";

export type BraceletColor = "Red" | "Orange" | "Yellow" | "Green" | "Blue";
/** A = Achieved, W = Working towards (sheet notation) */
export type SkillStatus = "A" | "W" | "—";
export type LevelStatus = "Complete" | "Incomplete" | "—";

export interface RosterChild {
  id: string;
  name: string;
  person_id: string;
  group_name: string | null;
  leader: { name: string } | null;
  season?: string | null;
}

export interface BraceletRecord {
  id: string;
  personId: string;
  name: string;
  group: string;
  divisionLeader: string;
  currentBracelet: BraceletColor | "";
  proctor1: string;
  date1: string;
  note1: string;
  proctor2: string;
  date2: string;
  note2: string;
  proctor3: string;
  date3: string;
  note3: string;
  emailSent: boolean;
}

export interface LevelRecord {
  id: string;
  personId: string;
  name: string;
  group: string;
  goldfish: SkillStatus[];
  goldfishLevel: LevelStatus;
  minnow: SkillStatus[];
  minnowLevel: LevelStatus;
  tadpole: SkillStatus[];
  tadpoleLevel: LevelStatus;
  redCross: LevelStatus;
  redCross2: LevelStatus;
  redCross3: LevelStatus;
  redCross4: LevelStatus;
  frog: LevelStatus;
  lastModified: string;
}

export interface SwimSeasonHistory {
  season: string;
  childId: string;
  childName: string;
  bracelet: BraceletRecord | null;
  levels: LevelRecord | null;
}

export const PROCTORS = ["MF", "JT", "VS", "KL", "AR"];
export const BRACELETS: BraceletColor[] = ["Red", "Orange", "Yellow", "Green", "Blue"];
export const PASS_OPTIONS = ["Passed", "Did Not Pass", "Retest"] as const;
export const SKILL_OPTIONS: SkillStatus[] = ["—", "A", "W"];
export const LEVEL_OPTIONS: LevelStatus[] = ["—", "Complete", "Incomplete"];
export const DATE_FMT = "MMMM d, yyyy";
export const CAMPERS_PAGE_SIZE = 1000;

const emptySkills4 = (): SkillStatus[] => ["—", "—", "—", "—"];
const emptySkills6 = (): SkillStatus[] => ["—", "—", "—", "—", "—", "—"];

export function normalizeSkillStatus(raw: unknown): SkillStatus {
  const s = String(raw ?? "").trim();
  if (!s || s === "—" || s === "-") return "—";
  if (s === "A" || s.toUpperCase() === "A") return "A";
  if (s === "W" || s.toUpperCase() === "W") return "W";
  if (/^achieved$/i.test(s)) return "A";
  if (/^working/i.test(s)) return "W";
  return "—";
}

export function normalizeLevelStatus(raw: unknown): LevelStatus {
  const s = String(raw ?? "").trim();
  if (s === "Complete" || /^complete$/i.test(s)) return "Complete";
  if (s === "Incomplete" || /^incomplete$/i.test(s)) return "Incomplete";
  return "—";
}

export function skillStatusLabel(status: SkillStatus): string {
  if (status === "A") return "Achieved";
  if (status === "W") return "Working towards";
  return "—";
}

export function levelFromSkills(skills: SkillStatus[]): LevelStatus {
  if (skills.length > 0 && skills.every((s) => s === "A")) return "Complete";
  if (skills.some((s) => s === "A" || s === "W")) return "Incomplete";
  return "—";
}

export function rosterGroup(child: RosterChild): string {
  return child.group_name?.trim() || "—";
}

export function rosterDivisionLeader(child: RosterChild): string {
  return child.leader?.name?.trim() || "—";
}

export function braceletFromChild(child: RosterChild): BraceletRecord {
  return {
    id: child.id,
    personId: child.person_id,
    name: child.name,
    group: rosterGroup(child),
    divisionLeader: rosterDivisionLeader(child),
    currentBracelet: "",
    proctor1: "",
    date1: "",
    note1: "",
    proctor2: "",
    date2: "",
    note2: "",
    proctor3: "",
    date3: "",
    note3: "",
    emailSent: false,
  };
}

export function levelFromChild(child: RosterChild): LevelRecord {
  const goldfish = emptySkills4();
  const minnow = emptySkills6();
  const tadpole = emptySkills4();
  return {
    id: child.id,
    personId: child.person_id,
    name: child.name,
    group: rosterGroup(child),
    goldfish,
    goldfishLevel: levelFromSkills(goldfish),
    minnow,
    minnowLevel: levelFromSkills(minnow),
    tadpole,
    tadpoleLevel: levelFromSkills(tadpole),
    redCross: "—",
    redCross2: "—",
    redCross3: "—",
    redCross4: "—",
    frog: "—",
    lastModified: "—",
  };
}

function parseSkillArray(raw: unknown, length: number): SkillStatus[] {
  if (!Array.isArray(raw)) return Array.from({ length }, () => "—" as SkillStatus);
  return Array.from({ length }, (_, i) => normalizeSkillStatus(raw[i]));
}

function braceletFromJson(child: RosterChild, raw: Record<string, unknown>): BraceletRecord {
  const base = braceletFromChild(child);
  const color = String(raw.currentBracelet ?? "").trim();
  return {
    ...base,
    currentBracelet: BRACELETS.includes(color as BraceletColor) ? (color as BraceletColor) : "",
    proctor1: String(raw.proctor1 ?? ""),
    date1: String(raw.date1 ?? ""),
    note1: String(raw.note1 ?? ""),
    proctor2: String(raw.proctor2 ?? ""),
    date2: String(raw.date2 ?? ""),
    note2: String(raw.note2 ?? ""),
    proctor3: String(raw.proctor3 ?? ""),
    date3: String(raw.date3 ?? ""),
    note3: String(raw.note3 ?? ""),
    emailSent: Boolean(raw.emailSent),
  };
}

function levelFromJson(child: RosterChild, raw: Record<string, unknown>, updatedAt?: string): LevelRecord {
  const goldfish = parseSkillArray(raw.goldfish, 4);
  const minnow = parseSkillArray(raw.minnow, 6);
  const tadpole = parseSkillArray(raw.tadpole, 4);
  return {
    id: child.id,
    personId: child.person_id,
    name: child.name,
    group: rosterGroup(child),
    goldfish,
    goldfishLevel: normalizeLevelStatus(raw.goldfishLevel) !== "—"
      ? normalizeLevelStatus(raw.goldfishLevel)
      : levelFromSkills(goldfish),
    minnow,
    minnowLevel: normalizeLevelStatus(raw.minnowLevel) !== "—"
      ? normalizeLevelStatus(raw.minnowLevel)
      : levelFromSkills(minnow),
    tadpole,
    tadpoleLevel: normalizeLevelStatus(raw.tadpoleLevel) !== "—"
      ? normalizeLevelStatus(raw.tadpoleLevel)
      : levelFromSkills(tadpole),
    redCross: normalizeLevelStatus(raw.redCross),
    redCross2: normalizeLevelStatus(raw.redCross2),
    redCross3: normalizeLevelStatus(raw.redCross3),
    redCross4: normalizeLevelStatus(raw.redCross4),
    frog: normalizeLevelStatus(raw.frog),
    lastModified: updatedAt ? formatSwimTimestamp(updatedAt) : String(raw.lastModified ?? "—"),
  };
}

export function braceletToJson(record: BraceletRecord): Record<string, unknown> {
  return {
    currentBracelet: record.currentBracelet,
    proctor1: record.proctor1,
    date1: record.date1,
    note1: record.note1,
    proctor2: record.proctor2,
    date2: record.date2,
    note2: record.note2,
    proctor3: record.proctor3,
    date3: record.date3,
    note3: record.note3,
    emailSent: record.emailSent,
  };
}

export function levelToJson(record: LevelRecord): Record<string, unknown> {
  return {
    goldfish: record.goldfish,
    goldfishLevel: record.goldfishLevel,
    minnow: record.minnow,
    minnowLevel: record.minnowLevel,
    tadpole: record.tadpole,
    tadpoleLevel: record.tadpoleLevel,
    redCross: record.redCross,
    redCross2: record.redCross2,
    redCross3: record.redCross3,
    redCross4: record.redCross4,
    frog: record.frog,
  };
}

export function formatSwimTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function mergeBracelets(
  saved: Map<string, BraceletRecord>,
  children: RosterChild[],
): BraceletRecord[] {
  return children.map((child) => {
    const prev = saved.get(child.id);
    const rosterFields = {
      name: child.name,
      personId: child.person_id,
      group: rosterGroup(child),
      divisionLeader: rosterDivisionLeader(child),
    };
    return prev ? { ...prev, ...rosterFields } : braceletFromChild(child);
  });
}

export function mergeLevels(saved: Map<string, LevelRecord>, children: RosterChild[]): LevelRecord[] {
  return children.map((child) => {
    const prev = saved.get(child.id);
    const rosterFields = { name: child.name, personId: child.person_id, group: rosterGroup(child) };
    return prev ? { ...prev, ...rosterFields } : levelFromChild(child);
  });
}

/** All campers for season (CampMinder-synced children — includes inactive). */
export async function fetchSwimRosterChildren(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<RosterChild[]> {
  const rows: RosterChild[] = [];
  let from = 0;

  for (;;) {
    const to = from + CAMPERS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, person_id, group_name, season, leader_id")
      .eq("company_id", companyId)
      .eq("season", season)
      .order("name")
      .range(from, to);

    if (error) throw error;
    type RowWithLeader = RosterChild & { leader_id?: string | null };
    const batch: RowWithLeader[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      person_id: String(row.person_id ?? row.id),
      group_name: row.group_name,
      season: row.season,
      leader_id: row.leader_id,
      leader: null,
    }));
    rows.push(...batch);
    if (batch.length < CAMPERS_PAGE_SIZE) break;
    from += CAMPERS_PAGE_SIZE;
  }

  const leaderIds = [
    ...new Set(
      rows
        .map((r) => (r as RosterChild & { leader_id?: string | null }).leader_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (leaderIds.length) {
    const { data: leaders } = await supabase.from("staff").select("id, name").in("id", leaderIds);
    const leaderById = new Map((leaders ?? []).map((s) => [s.id, s.name]));
    for (const row of rows) {
      const lid = (row as RosterChild & { leader_id?: string | null }).leader_id;
      if (lid && leaderById.has(lid)) {
        row.leader = { name: leaderById.get(lid)! };
      }
    }
  }

  rows.sort(compareByLastName);
  return rows;
}

type SwimDbRow = {
  child_id: string;
  person_id: string | null;
  bracelet: Record<string, unknown> | null;
  levels: Record<string, unknown> | null;
  updated_at: string | null;
};

/** True when migration 20260921160000_swim_program_records has not been applied yet. */
export function isSwimTableMissingError(error: unknown): boolean {
  const e = error as { code?: string; message?: string; status?: number };
  const msg = String(e?.message ?? "").toLowerCase();
  return (
    e?.code === "42P01" ||
    e?.code === "PGRST205" ||
    e?.status === 404 ||
    (msg.includes("swim_program_records") &&
      (msg.includes("does not exist") || msg.includes("could not find") || msg.includes("not found")))
  );
}

/** Saved swim rows for one season (no roster fetch). */
export async function loadSwimSavedRecords(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  childById: Map<string, RosterChild>,
): Promise<{ bracelets: Map<string, BraceletRecord>; levels: Map<string, LevelRecord> }> {
  const { data, error } = await supabase
    .from("swim_program_records")
    .select("child_id, person_id, bracelet, levels, updated_at")
    .eq("company_id", companyId)
    .eq("season", season);

  if (error) {
    if (isSwimTableMissingError(error)) {
      console.warn("[swimProgram] swim_program_records not found — apply migration 20260921160000");
      return { bracelets: new Map(), levels: new Map() };
    }
    throw error;
  }

  const bracelets = new Map<string, BraceletRecord>();
  const levels = new Map<string, LevelRecord>();

  for (const row of (data ?? []) as SwimDbRow[]) {
    const child = childById.get(row.child_id);
    if (!child) continue;
    if (row.bracelet && typeof row.bracelet === "object") {
      bracelets.set(row.child_id, braceletFromJson(child, row.bracelet));
    }
    if (row.levels && typeof row.levels === "object") {
      levels.set(row.child_id, levelFromJson(child, row.levels, row.updated_at ?? undefined));
    }
  }

  return { bracelets, levels };
}

export async function loadSwimProgramData(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<{ bracelets: Map<string, BraceletRecord>; levels: Map<string, LevelRecord> }> {
  const children = await fetchSwimRosterChildren(supabase, companyId, season);
  const childById = new Map(children.map((c) => [c.id, c]));
  return loadSwimSavedRecords(supabase, companyId, season, childById);
}

export type SwimHistoryReportRow = {
  personId: string;
  name: string;
  seasons: Array<{
    season: string;
    childId: string;
    bracelet: BraceletRecord | null;
    levels: LevelRecord | null;
  }>;
};

/** All prior + current swim data grouped by camper (person_id) for reporting. */
export async function fetchSwimHistoryReport(
  supabase: SupabaseClient,
  companyId: string,
): Promise<SwimHistoryReportRow[]> {
  const { data: childRows, error: childErr } = await supabase
    .from("children")
    .select("id, name, person_id, season, group_name, leader_id")
    .eq("company_id", companyId)
    .order("season", { ascending: false });

  if (childErr) throw childErr;

  const { data: swimRows, error: swimErr } = await supabase
    .from("swim_program_records")
    .select("child_id, season, bracelet, levels, updated_at, person_id")
    .eq("company_id", companyId);

  if (swimErr) {
    if (isSwimTableMissingError(swimErr)) return [];
    throw swimErr;
  }

  const swimByChild = new Map((swimRows ?? []).map((r) => [r.child_id as string, r]));
  const byPerson = new Map<string, SwimHistoryReportRow>();

  for (const child of childRows ?? []) {
    const personId = String(child.person_id ?? child.id);
    const rosterChild: RosterChild = {
      id: child.id,
      name: child.name,
      person_id: personId,
      group_name: child.group_name,
      leader: null,
    };
    const swim = swimByChild.get(child.id);
    const bracelet =
      swim?.bracelet && typeof swim.bracelet === "object"
        ? braceletFromJson(rosterChild, swim.bracelet as Record<string, unknown>)
        : null;
    const levels =
      swim?.levels && typeof swim.levels === "object"
        ? levelFromJson(rosterChild, swim.levels as Record<string, unknown>, swim.updated_at ?? undefined)
        : null;

    const hasData =
      Boolean(bracelet?.currentBracelet) ||
      (levels?.goldfish.some((s) => s !== "—") ?? false) ||
      (levels?.minnow.some((s) => s !== "—") ?? false) ||
      (levels?.tadpole.some((s) => s !== "—") ?? false);

    if (!hasData) continue;

    let row = byPerson.get(personId);
    if (!row) {
      row = { personId, name: child.name, seasons: [] };
      byPerson.set(personId, row);
    }
    row.seasons.push({
      season: String(child.season ?? swim?.season ?? "—"),
      childId: child.id,
      bracelet,
      levels,
    });
  }

  return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Distinct seasons with campers (for season selector). */
export async function fetchSwimSeasons(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("children")
    .select("season")
    .eq("company_id", companyId)
    .not("season", "is", null);

  if (error) throw error;
  const seasons = [...new Set((data ?? []).map((r) => String(r.season)).filter(Boolean))];
  seasons.sort((a, b) => b.localeCompare(a));
  return seasons;
}

/** All campers across all seasons (for Airtable / historical CSV import). */
export async function fetchAllSwimRosterChildren(
  supabase: SupabaseClient,
  companyId: string,
): Promise<RosterChild[]> {
  const rows: RosterChild[] = [];
  let from = 0;

  for (;;) {
    const to = from + CAMPERS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, person_id, group_name, season, leader_id")
      .eq("company_id", companyId)
      .order("season", { ascending: false })
      .order("name")
      .range(from, to);

    if (error) throw error;
    const batch = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      person_id: String(row.person_id ?? row.id),
      group_name: row.group_name,
      leader: null,
      season: row.season as string | null,
    })) as (RosterChild & { season: string | null })[];
    rows.push(...batch);
    if (batch.length < CAMPERS_PAGE_SIZE) break;
    from += CAMPERS_PAGE_SIZE;
  }

  return rows;
}

async function fetchExistingSwimRow(
  supabase: SupabaseClient,
  companyId: string,
  childId: string,
  season: string,
): Promise<{ bracelet: Record<string, unknown>; levels: Record<string, unknown>; source: string } | null> {
  const { data, error } = await supabase
    .from("swim_program_records")
    .select("bracelet, levels, source")
    .eq("company_id", companyId)
    .eq("child_id", childId)
    .eq("season", season)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    bracelet: (data.bracelet as Record<string, unknown>) ?? {},
    levels: (data.levels as Record<string, unknown>) ?? {},
    source: String(data.source ?? "manual"),
  };
}

export async function saveSwimBracelet(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  record: BraceletRecord,
  source = "manual",
): Promise<void> {
  const existing = await fetchExistingSwimRow(supabase, companyId, record.id, season);
  const { error } = await supabase.from("swim_program_records").upsert(
    {
      company_id: companyId,
      child_id: record.id,
      season,
      person_id: record.personId,
      bracelet: braceletToJson(record),
      levels: existing?.levels ?? {},
      source: existing?.source ?? source,
    },
    { onConflict: "company_id,child_id,season" },
  );
  if (error) throw error;
}

export async function saveSwimLevel(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  record: LevelRecord,
  source = "manual",
): Promise<void> {
  const existing = await fetchExistingSwimRow(supabase, companyId, record.id, season);
  const { error } = await supabase.from("swim_program_records").upsert(
    {
      company_id: companyId,
      child_id: record.id,
      season,
      person_id: record.personId,
      bracelet: existing?.bracelet ?? {},
      levels: levelToJson(record),
      source: existing?.source ?? source,
    },
    { onConflict: "company_id,child_id,season" },
  );
  if (error) throw error;
}

export async function fetchSwimHistoryByPerson(
  supabase: SupabaseClient,
  companyId: string,
  personId: string,
): Promise<SwimSeasonHistory[]> {
  const { data: childRows, error: childErr } = await supabase
    .from("children")
    .select("id, name, season")
    .eq("company_id", companyId)
    .eq("person_id", personId)
    .order("season", { ascending: false });

  if (childErr) throw childErr;
  if (!childRows?.length) return [];

  const childIds = childRows.map((c) => c.id);
  const { data: swimRows, error: swimErr } = await supabase
    .from("swim_program_records")
    .select("child_id, season, bracelet, levels, updated_at")
    .eq("company_id", companyId)
    .in("child_id", childIds);

  if (swimErr) throw swimErr;

  const swimByChild = new Map((swimRows ?? []).map((r) => [r.child_id as string, r]));

  return childRows.map((child) => {
    const swim = swimByChild.get(child.id);
    const rosterChild: RosterChild = {
      id: child.id,
      name: child.name,
      person_id: personId,
      group_name: null,
      leader: null,
    };
    const bracelet =
      swim?.bracelet && typeof swim.bracelet === "object"
        ? braceletFromJson(rosterChild, swim.bracelet as Record<string, unknown>)
        : null;
    const levels =
      swim?.levels && typeof swim.levels === "object"
        ? levelFromJson(rosterChild, swim.levels as Record<string, unknown>, swim.updated_at ?? undefined)
        : null;
    return {
      season: String(child.season ?? swim?.season ?? "—"),
      childId: child.id,
      childName: child.name,
      bracelet,
      levels,
    };
  });
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function resolveSkillHeader(h: string): { group: "goldfish" | "minnow" | "tadpole"; index: number } | null {
  const n = normHeader(h);
  if (SKILL_HEADER_MAP[n]) return SKILL_HEADER_MAP[n];
  const m = n.match(/^(goldfish|minnow|tadpole).*?(1[abc])([1-6])$/);
  if (!m) return null;
  const group = m[1] as "goldfish" | "minnow" | "tadpole";
  const index = Number(m[3]) - 1;
  if (group === "goldfish" && index >= 4) return null;
  if (group === "tadpole" && index >= 4) return null;
  if (group === "minnow" && index >= 6) return null;
  return { group, index };
}

const SKILL_HEADER_MAP: Record<string, { group: "goldfish" | "minnow" | "tadpole"; index: number }> = {
  goldfish_1a1: { group: "goldfish", index: 0 },
  goldfish_1a2: { group: "goldfish", index: 1 },
  goldfish_1a3: { group: "goldfish", index: 2 },
  goldfish_1a4: { group: "goldfish", index: 3 },
  minnow_1b1: { group: "minnow", index: 0 },
  minnow_1b2: { group: "minnow", index: 1 },
  minnow_1b3: { group: "minnow", index: 2 },
  minnow_1b4: { group: "minnow", index: 3 },
  minnow_1b5: { group: "minnow", index: 4 },
  minnow_1b6: { group: "minnow", index: 5 },
  tadpole_1c1: { group: "tadpole", index: 0 },
  tadpole_1c2: { group: "tadpole", index: 1 },
  tadpole_1c3: { group: "tadpole", index: 2 },
  tadpole_1c4: { group: "tadpole", index: 3 },
};

function buildSwimChildIndex(children: RosterChild[]) {
  const byId = new Map<string, RosterChild>();
  const bySeasonName = new Map<string, RosterChild>();
  const bySeasonPerson = new Map<string, RosterChild>();
  for (const c of children) {
    const season = String(c.season ?? "");
    byId.set(c.id, c);
    bySeasonName.set(`${season}|${c.name.trim().toLowerCase()}`, c);
    bySeasonPerson.set(`${season}|${c.person_id}`, c);
  }
  return { byId, bySeasonName, bySeasonPerson };
}

function resolveChildForImportRow(
  cols: string[],
  headers: string[],
  index: ReturnType<typeof buildSwimChildIndex>,
  defaultSeason: string,
): RosterChild | null {
  const nameIdx = headers.findIndex((h) => h === "name" || h === "child_name" || h === "camper");
  const childIdIdx = headers.findIndex((h) => h === "child_id" || h === "id");
  const personIdx = headers.findIndex((h) => h === "person_id" || h === "campminder_id");
  const seasonIdx = headers.findIndex((h) => h === "season" || h === "year");

  const season = (seasonIdx >= 0 ? cols[seasonIdx]?.trim() : "") || defaultSeason;
  const childId = childIdIdx >= 0 ? cols[childIdIdx]?.trim() : "";
  const personId = personIdx >= 0 ? cols[personIdx]?.trim() : "";
  const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";

  if (childId && index.byId.has(childId)) {
    const c = index.byId.get(childId)!;
    if (!season || String(c.season) === season) return c;
  }
  if (personId) {
    const hit = index.bySeasonPerson.get(`${season}|${personId}`);
    if (hit) return hit;
  }
  if (name) {
    const hit = index.bySeasonName.get(`${season}|${name.toLowerCase()}`);
    if (hit) return hit;
  }
  return null;
}

export type SwimCsvImportRow = {
  child: RosterChild;
  season: string;
  bracelet?: Partial<BraceletRecord>;
  levels?: Partial<LevelRecord>;
};

/** Parse Airtable / sheet CSV — supports season + person_id columns for prior years. */
export function parseSwimProgramCsv(
  csvText: string,
  children: RosterChild[],
  defaultSeason: string,
): { rows: SwimCsvImportRow[]; unmatched: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], unmatched: [] };

  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(normHeader);
  const braceletIdx = headers.findIndex((h) => h === "current_bracelet" || h === "bracelet");
  const nameIdx = headers.findIndex((h) => h === "name" || h === "child_name" || h === "camper");
  const seasonIdx = headers.findIndex((h) => h === "season" || h === "year");

  const index = buildSwimChildIndex(children);
  const rows: SwimCsvImportRow[] = [];
  const unmatched: string[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    const child = resolveChildForImportRow(cols, headers, index, defaultSeason);
    const season = (seasonIdx >= 0 ? cols[seasonIdx]?.trim() : "") || defaultSeason;
    const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";

    if (!child) {
      if (name) unmatched.push(season ? `${name} (${season})` : name);
      continue;
    }

    const importRow: SwimCsvImportRow = { child, season: String(child.season ?? season) };

    if (braceletIdx >= 0) {
      const color = cols[braceletIdx]?.trim();
      if (color && BRACELETS.includes(color as BraceletColor)) {
        importRow.bracelet = { currentBracelet: color as BraceletColor };
      }
    }

    const goldfish = emptySkills4();
    const minnow = emptySkills6();
    const tadpole = emptySkills4();
    let hasSkill = false;

    headers.forEach((h, idx) => {
      const map = resolveSkillHeader(h);
      if (!map) return;
      const val = normalizeSkillStatus(cols[idx]);
      if (val !== "—") hasSkill = true;
      if (map.group === "goldfish") goldfish[map.index] = val;
      if (map.group === "minnow") minnow[map.index] = val;
      if (map.group === "tadpole") tadpole[map.index] = val;
    });

    if (hasSkill) {
      importRow.levels = {
        goldfish,
        goldfishLevel: levelFromSkills(goldfish),
        minnow,
        minnowLevel: levelFromSkills(minnow),
        tadpole,
        tadpoleLevel: levelFromSkills(tadpole),
      };
    }

    if (importRow.bracelet || importRow.levels) rows.push(importRow);
  }

  return { rows, unmatched };
}

/** Import parsed CSV rows into swim_program_records (supports prior seasons). */
export async function importSwimProgramRows(
  supabase: SupabaseClient,
  companyId: string,
  parsed: SwimCsvImportRow[],
): Promise<{ bracelets: number; levels: number }> {
  let bracelets = 0;
  let levels = 0;

  for (const row of parsed) {
    const base = braceletFromChild(row.child);
    if (row.bracelet) {
      const merged = { ...base, ...row.bracelet };
      await saveSwimBracelet(supabase, companyId, row.season, merged, "airtable");
      bracelets++;
    }
    if (row.levels) {
      const merged = { ...levelFromChild(row.child), ...row.levels, lastModified: "Imported" };
      await saveSwimLevel(supabase, companyId, row.season, merged, "airtable");
      levels++;
    }
  }

  return { bracelets, levels };
}

export async function importSwimProgramCsv(
  supabase: SupabaseClient,
  companyId: string,
  csvText: string,
  defaultSeason: string,
): Promise<{ bracelets: number; levels: number; unmatched: string[] }> {
  const children = await fetchAllSwimRosterChildren(supabase, companyId);
  const { rows, unmatched } = parseSwimProgramCsv(csvText, children, defaultSeason);
  const counts = await importSwimProgramRows(supabase, companyId, rows);
  return { ...counts, unmatched };
}

export function swimProgramCsvTemplate(): string {
  return [
    "season,name,person_id,current_bracelet,goldfish_1A1,goldfish_1A2,goldfish_1A3,goldfish_1A4,minnow_1B1,minnow_1B2,minnow_1B3,minnow_1B4,minnow_1B5,minnow_1B6,tadpole_1C1,tadpole_1C2,tadpole_1C3,tadpole_1C4",
    "2026,Jane Doe,,Orange,A,A,W,—,A,W,—,—,—,—,—,—,—,—",
    "2027,Jane Doe,,Green,W,—,—,—,—,—,—,—,—,—,—,—,—,—",
  ].join("\n");
}
