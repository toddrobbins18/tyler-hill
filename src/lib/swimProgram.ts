import type { SupabaseClient } from "@supabase/supabase-js";
import { compareByLastName } from "@/lib/nameSortUtils";
import { filterActiveRoster } from "@/lib/rosterStatus";

export type BraceletColor =
  | "Non Swimmer/Beginner"
  | "Red"
  | "Orange"
  | "Yellow"
  | "Green"
  | "Blue";
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
  /** Airtable "Note Field" — freeform camper note. */
  generalNote: string;
  proctor1: string;
  date1: string;
  note1: string;
  proctor2: string;
  date2: string;
  note2: string;
  proctor3: string;
  date3: string;
  note3: string;
  proctor4: string;
  date4: string;
  note4: string;
  proctor5: string;
  date5: string;
  note5: string;
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
  /** Red Cross 1 exit skills (2 required assessments). */
  exitSkills: SkillStatus[];
  lastModified: string;
}

export const EXIT_SKILL_COUNT = 2;

export interface SwimSeasonHistory {
  season: string;
  childId: string;
  childName: string;
  bracelet: BraceletRecord | null;
  levels: LevelRecord | null;
}

/** Airtable Swim Bracelets 2026 — 3rd Test Proctor options. */
export const SWIM_PROCTOR_OPTIONS = ["VS", "JT", "MF", "BNO", "RB", "Ellie"] as const;

/** Fallback initials when roster proctors have not been loaded yet. */
export const PROCTORS = [...SWIM_PROCTOR_OPTIONS];

/** Airtable Swim Bracelets 2026 — Current Bracelet single-select. */
export const BRACELETS: BraceletColor[] = [
  "Non Swimmer/Beginner",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
];

/** Airtable Swim Bracelets 2026 — Division Leader single-select. */
export const DIVISION_LEADER_OPTIONS = [
  "Alyssa",
  "Aubrey",
  "Jess Cohen",
  "CANDRA",
  "CARLOTA",
  "JAMIE",
  "LAUREN M",
  "ALLIE O",
  "LINDSAY G",
  "LISA C",
  "Jess",
  "Sara O",
  "Ricki",
] as const;

/** Airtable Swim Bracelets 2026 — test note options (1st–5th Note). */
export const SWIM_TEST_NOTE_OPTIONS = [
  "Backfloat form needs work",
  "Backfloat needs endurance",
  "Lap swimming form needs work",
  "Needed Assist",
  "Needs endurance to do 2nd lap",
  "No Backfloat",
  "No Tread",
  "PASSED",
  "Refused",
  "Tread form needs work",
  "Tread needs endurance",
  "ZZZ Stamina Needs Work",
] as const;

export type SwimTestNote = (typeof SWIM_TEST_NOTE_OPTIONS)[number];

/** @deprecated Use SWIM_TEST_NOTE_OPTIONS — kept for legacy imports. */
export const PASS_OPTIONS = ["Passed", "Did Not Pass", "Retest"] as const;
export type PassStatus = (typeof PASS_OPTIONS)[number];

/** Airtable Swim Records views — column sets mirror Red Cross 1–6 + ALL KIDS. */
export type SwimLevelReportView =
  | "all"
  | "red-cross-1"
  | "red-cross-2"
  | "red-cross-3"
  | "red-cross-4"
  | "red-cross-5"
  | "red-cross-6";

export const SWIM_LEVEL_REPORT_VIEWS: { value: SwimLevelReportView; label: string }[] = [
  { value: "red-cross-1", label: "Red Cross 1" },
  { value: "red-cross-2", label: "Red Cross 2" },
  { value: "red-cross-3", label: "Red Cross 3" },
  { value: "red-cross-4", label: "Red Cross 4" },
  { value: "red-cross-5", label: "Red Cross 5" },
  { value: "red-cross-6", label: "Red Cross 6" },
  { value: "all", label: "ALL KIDS" },
];

const SWIM_LEVEL_VIEW_COLUMNS: Record<Exclude<SwimLevelReportView, "all">, Set<string>> = {
  "red-cross-1": new Set([
    "goldfish-0",
    "goldfish-1",
    "goldfish-2",
    "goldfish-3",
    "goldfishLevel",
    "exit-0",
    "exit-1",
  ]),
  "red-cross-2": new Set([
    "minnow-0",
    "minnow-1",
    "minnow-2",
    "minnow-3",
    "minnow-4",
    "minnow-5",
    "minnowLevel",
  ]),
  "red-cross-3": new Set([
    "tadpole-0",
    "tadpole-1",
    "tadpole-2",
    "tadpole-3",
    "tadpoleLevel",
    "redCross",
    "frog",
  ]),
  "red-cross-4": new Set(["redCross2"]),
  "red-cross-5": new Set(["redCross3"]),
  "red-cross-6": new Set(["redCross4"]),
};

/** Whether a level-report column appears for the selected Airtable-style view. */
export function swimLevelColumnVisible(view: SwimLevelReportView, column: string): boolean {
  if (view === "all") return true;
  if (column === "name" || column === "group" || column === "lastModified") return true;
  return SWIM_LEVEL_VIEW_COLUMNS[view].has(column);
}

export function staffNameToInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() ?? "";
}

export function mergeProctorOptions(base: string[], extra: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of [...base, ...extra]) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function normalizeSwimTestNote(raw: unknown): SwimTestNote | "" {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const exact = SWIM_TEST_NOTE_OPTIONS.find((opt) => opt.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  if (/^passed$/i.test(s)) return "PASSED";
  if (/^did not pass$/i.test(s) || /^fail(ed)?$/i.test(s)) return "Refused";
  if (/^retest$/i.test(s)) return "";
  return "";
}

/** @deprecated Use normalizeSwimTestNote */
export function normalizePassStatus(raw: unknown): PassStatus | "" {
  const note = normalizeSwimTestNote(raw);
  if (note === "PASSED") return "Passed";
  if (note === "Refused") return "Did Not Pass";
  const s = String(raw ?? "").trim();
  if (s === "Retest" || /^retest$/i.test(s)) return "Retest";
  return "";
}

export function normalizeBraceletColor(raw: unknown): BraceletColor | "" {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const match = BRACELETS.find((c) => c.toLowerCase() === s.toLowerCase());
  if (match) return match;
  if (/^non\s*swimmer/i.test(s) || /^beginner$/i.test(s)) return "Non Swimmer/Beginner";
  return "";
}

export function isBlankDivisionLeader(value?: string | null): boolean {
  const s = value?.trim();
  return !s || s === "—" || s === "-";
}

/** Match a roster / saved name to the closest Airtable division-leader option. */
export function matchDivisionLeaderOption(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const exact = DIVISION_LEADER_OPTIONS.find((opt) => opt.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  const firstToken = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
  const byFirst = DIVISION_LEADER_OPTIONS.find(
    (opt) => opt.toLowerCase() === firstToken || opt.toLowerCase().startsWith(firstToken),
  );
  if (byFirst) return byFirst;
  const partial = DIVISION_LEADER_OPTIONS.find(
    (opt) =>
      trimmed.toLowerCase().includes(opt.toLowerCase())
      || opt.toLowerCase().includes(trimmed.toLowerCase()),
  );
  return partial ?? trimmed;
}

export function normalizeDivisionLeader(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (isBlankDivisionLeader(s)) return "";
  return matchDivisionLeaderOption(s);
}

export function resolveDivisionLeaderFromRoster(child: RosterChild): string {
  const rosterName = child.leader?.name?.trim();
  if (!rosterName) return "—";
  return matchDivisionLeaderOption(rosterName);
}

export function resolveStoredDivisionLeader(saved: string | undefined, child: RosterChild): string {
  if (!isBlankDivisionLeader(saved)) return matchDivisionLeaderOption(saved!);
  return resolveDivisionLeaderFromRoster(child);
}

export function mergeSwimTestNoteOptions(extra: string[]): string[] {
  return mergeProctorOptions([...SWIM_TEST_NOTE_OPTIONS], extra);
}

export function mergeDivisionLeaderOptions(extra: string[]): string[] {
  return mergeProctorOptions([...DIVISION_LEADER_OPTIONS], extra);
}

/** @deprecated Use mergeSwimTestNoteOptions */
export function mergePassOptions(extra: string[]): string[] {
  return mergeProctorOptions([...PASS_OPTIONS], extra);
}
export const SKILL_OPTIONS: SkillStatus[] = ["—", "A", "W"];
export const LEVEL_OPTIONS: LevelStatus[] = ["—", "Complete", "Incomplete"];
export const DATE_FMT = "MMMM d, yyyy";
export const CAMPERS_PAGE_SIZE = 1000;

const emptySkills4 = (): SkillStatus[] => ["—", "—", "—", "—"];
const emptySkills6 = (): SkillStatus[] => ["—", "—", "—", "—", "—", "—"];
const emptyExitSkills = (): SkillStatus[] => Array.from({ length: EXIT_SKILL_COUNT }, () => "—" as SkillStatus);

export function normalizeSkillStatus(raw: unknown): SkillStatus {
  const s = String(raw ?? "").trim();
  if (!s || s === "—" || s === "-") return "—";
  if (/^https?:\/\//i.test(s) || /airtableusercontent|\.jpe?g|\.png/i.test(s)) return "—";
  if (s === "A" || s.toUpperCase() === "A") return "A";
  if (s === "W" || s.toUpperCase() === "W") return "W";
  if (/^achieved$/i.test(s)) return "A";
  if (/^working/i.test(s)) return "W";
  return "—";
}

export function normalizeLevelStatus(raw: unknown): LevelStatus {
  const s = String(raw ?? "").trim();
  if (!s || /^https?:\/\//i.test(s) || /airtableusercontent|\.jpe?g|\.png/i.test(s)) return "—";
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
    generalNote: "",
    proctor1: "",
    date1: "",
    note1: "",
    proctor2: "",
    date2: "",
    note2: "",
    proctor3: "",
    date3: "",
    note3: "",
    proctor4: "",
    date4: "",
    note4: "",
    proctor5: "",
    date5: "",
    note5: "",
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
    exitSkills: emptyExitSkills(),
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
  const importedGroup = String(raw.group ?? "").trim();
  return {
    ...base,
    group: importedGroup || base.group,
    divisionLeader: resolveStoredDivisionLeader(String(raw.divisionLeader ?? ""), child),
    currentBracelet: normalizeBraceletColor(color),
    generalNote: String(raw.generalNote ?? raw.noteField ?? "").trim(),
    proctor1: String(raw.proctor1 ?? "").trim(),
    date1: String(raw.date1 ?? ""),
    note1: normalizeSwimTestNote(raw.note1) || String(raw.note1 ?? "").trim(),
    proctor2: String(raw.proctor2 ?? "").trim(),
    date2: String(raw.date2 ?? ""),
    note2: normalizeSwimTestNote(raw.note2) || String(raw.note2 ?? "").trim(),
    proctor3: String(raw.proctor3 ?? "").trim(),
    date3: String(raw.date3 ?? ""),
    note3: normalizeSwimTestNote(raw.note3) || String(raw.note3 ?? "").trim(),
    proctor4: String(raw.proctor4 ?? raw["4th_test_proctor"] ?? "").trim(),
    date4: String(raw.date4 ?? raw["4th_testing_date"] ?? ""),
    note4: normalizeSwimTestNote(raw.note4 ?? raw["4th_note"]) || String(raw.note4 ?? raw["4th_note"] ?? "").trim(),
    proctor5: String(raw.proctor5 ?? raw["5th_test_proctor"] ?? "").trim(),
    date5: String(raw.date5 ?? raw["5th_testing_date"] ?? ""),
    note5: normalizeSwimTestNote(raw.note5 ?? raw["5th_note"]) || String(raw.note5 ?? raw["5th_note"] ?? "").trim(),
    emailSent: Boolean(raw.emailSent),
  };
}

function levelFromJson(child: RosterChild, raw: Record<string, unknown>, updatedAt?: string): LevelRecord {
  const goldfish = parseSkillArray(raw.goldfish, 4);
  const minnow = parseSkillArray(raw.minnow, 6);
  const tadpole = parseSkillArray(raw.tadpole, 4);
  const importedGroup = String(raw.group ?? "").trim();
  return {
    id: child.id,
    personId: child.person_id,
    name: child.name,
    group: importedGroup || rosterGroup(child),
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
    exitSkills: parseSkillArray(raw.exitSkills, EXIT_SKILL_COUNT),
    lastModified: updatedAt ? formatSwimTimestamp(updatedAt) : String(raw.lastModified ?? "—"),
  };
}

export function braceletToJson(record: BraceletRecord): Record<string, unknown> {
  return {
    group: record.group !== "—" ? record.group : "",
    divisionLeader: record.divisionLeader !== "—" ? record.divisionLeader : "",
    currentBracelet: record.currentBracelet,
    generalNote: record.generalNote,
    proctor1: record.proctor1,
    date1: record.date1,
    note1: record.note1,
    proctor2: record.proctor2,
    date2: record.date2,
    note2: record.note2,
    proctor3: record.proctor3,
    date3: record.date3,
    note3: record.note3,
    proctor4: record.proctor4,
    date4: record.date4,
    note4: record.note4,
    proctor5: record.proctor5,
    date5: record.date5,
    note5: record.note5,
    emailSent: record.emailSent,
  };
}

export function levelToJson(record: LevelRecord): Record<string, unknown> {
  return {
    group: record.group !== "—" ? record.group : "",
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
    exitSkills: record.exitSkills,
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

function resolveDisplayGroup(roster: string, saved?: string): string {
  if (roster && roster !== "—") return roster;
  if (saved?.trim()) return saved.trim();
  return roster || "—";
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
      group: resolveDisplayGroup(rosterGroup(child), prev?.group),
      divisionLeader: resolveStoredDivisionLeader(prev?.divisionLeader, child),
    };
    return prev ? { ...prev, ...rosterFields } : braceletFromChild(child);
  });
}

export function mergeLevels(saved: Map<string, LevelRecord>, children: RosterChild[]): LevelRecord[] {
  return children.map((child) => {
    const prev = saved.get(child.id);
    const rosterFields = {
      name: child.name,
      personId: child.person_id,
      group: resolveDisplayGroup(rosterGroup(child), prev?.group),
    };
    return prev ? { ...prev, ...rosterFields } : levelFromChild(child);
  });
}

export type SwimRosterLoadResult = {
  children: RosterChild[];
  /** Inactive roster rows excluded from the swim UI (cancelled / historical). */
  inactiveHidden: number;
};

/** Active campers for season (matches CampMinder enrolled roster). */
export async function fetchSwimRosterChildren(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<SwimRosterLoadResult> {
  type RowWithLeader = RosterChild & { leader_id?: string | null; status?: string | null };
  const rows: RowWithLeader[] = [];
  let from = 0;

  for (;;) {
    const to = from + CAMPERS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, person_id, group_name, season, leader_id, status")
      .eq("company_id", companyId)
      .eq("season", season)
      .order("name")
      .range(from, to);

    if (error) throw error;
    const batch: RowWithLeader[] = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      person_id: String(row.person_id ?? row.id),
      group_name: row.group_name,
      season: row.season,
      leader_id: row.leader_id,
      status: row.status,
      leader: null,
    }));
    rows.push(...batch);
    if (batch.length < CAMPERS_PAGE_SIZE) break;
    from += CAMPERS_PAGE_SIZE;
  }

  const children = filterActiveRoster(rows);
  const inactiveHidden = rows.length - children.length;

  const leaderIds = [
    ...new Set(
      children
        .map((r) => (r as RowWithLeader).leader_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (leaderIds.length) {
    const { data: leaders } = await supabase.from("staff").select("id, name").in("id", leaderIds);
    const leaderById = new Map((leaders ?? []).map((s) => [s.id, s.name]));
    for (const row of children) {
      const lid = (row as RowWithLeader).leader_id;
      if (lid && leaderById.has(lid)) {
        row.leader = { name: leaderById.get(lid)! };
      }
    }
  }

  children.sort(compareByLastName);
  return { children, inactiveHidden };
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
  const { children } = await fetchSwimRosterChildren(supabase, companyId, season);
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

type SwimDbHistoryRow = {
  child_id: string;
  season: string | null;
  bracelet: unknown;
  levels: unknown;
  updated_at: string | null;
  person_id: string | null;
};

type ChildHistoryRow = {
  id: string;
  name: string;
  person_id: string | null;
  season: string | null;
  group_name: string | null;
};

/** Whether a saved swim row should appear on Prior Seasons Report (matches Level Report “has data”). */
export function swimHistoryRecordHasData(
  bracelet: BraceletRecord | null,
  levels: LevelRecord | null,
): boolean {
  if (bracelet?.currentBracelet) return true;
  if (!levels) return false;
  return (
    levels.goldfish.some((s) => s !== "—") ||
    levels.minnow.some((s) => s !== "—") ||
    levels.tadpole.some((s) => s !== "—") ||
    levels.exitSkills.some((s) => s !== "—") ||
    [
      levels.goldfishLevel,
      levels.minnowLevel,
      levels.tadpoleLevel,
      levels.redCross,
      levels.redCross2,
      levels.redCross3,
      levels.redCross4,
      levels.frog,
    ].some((s) => s !== "—")
  );
}

async function fetchAllSwimProgramRecords(
  supabase: SupabaseClient,
  companyId: string,
): Promise<SwimDbHistoryRow[]> {
  const rows: SwimDbHistoryRow[] = [];
  let from = 0;

  for (;;) {
    const to = from + CAMPERS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("swim_program_records")
      .select("child_id, season, bracelet, levels, updated_at, person_id")
      .eq("company_id", companyId)
      .order("season", { ascending: false })
      .order("child_id")
      .range(from, to);

    if (error) {
      if (isSwimTableMissingError(error)) return [];
      throw error;
    }

    const batch = (data ?? []) as SwimDbHistoryRow[];
    rows.push(...batch);
    if (batch.length < CAMPERS_PAGE_SIZE) break;
    from += CAMPERS_PAGE_SIZE;
  }

  return rows;
}

function resolveChildForSwimHistoryRow(
  swim: SwimDbHistoryRow,
  childRows: ChildHistoryRow[],
  childById: Map<string, ChildHistoryRow>,
  childByPersonSeason: Map<string, ChildHistoryRow>,
): ChildHistoryRow | null {
  const swimSeason = String(swim.season ?? "");
  const personId = String(swim.person_id ?? "").trim();

  if (personId) {
    const byPersonSeason = childByPersonSeason.get(`${personId}|${swimSeason}`);
    if (byPersonSeason) return byPersonSeason;
  }

  const byId = childById.get(swim.child_id);
  if (byId && String(byId.season ?? "") === swimSeason) return byId;

  const byIdAndSeason = childRows.find((c) => c.id === swim.child_id && String(c.season ?? "") === swimSeason);
  if (byIdAndSeason) return byIdAndSeason;

  if (personId) {
    const anySeason = childRows.find((c) => String(c.person_id ?? "") === personId);
    if (anySeason) {
      return { ...anySeason, season: swimSeason || anySeason.season };
    }
  }

  const braceletJson =
    swim.bracelet && typeof swim.bracelet === "object" ? (swim.bracelet as Record<string, unknown>) : null;
  const levelsJson =
    swim.levels && typeof swim.levels === "object" ? (swim.levels as Record<string, unknown>) : null;
  const nameFromJson = String(braceletJson?.name ?? levelsJson?.name ?? "").trim();
  if (!nameFromJson && !personId) return null;

  return {
    id: swim.child_id,
    name: nameFromJson || `Camper ${personId || swim.child_id.slice(0, 8)}`,
    person_id: personId || swim.child_id,
    season: swimSeason,
    group_name: null,
  };
}

/** All prior + current swim data grouped by camper (person_id) for reporting. */
export async function fetchSwimHistoryReport(
  supabase: SupabaseClient,
  companyId: string,
): Promise<SwimHistoryReportRow[]> {
  const rosterChildren = await fetchAllSwimRosterChildren(supabase, companyId);
  const childRows: ChildHistoryRow[] = rosterChildren.map((c) => ({
    id: c.id,
    name: c.name,
    person_id: c.person_id,
    season: c.season ?? null,
    group_name: c.group_name,
  }));

  const swimRows = await fetchAllSwimProgramRecords(supabase, companyId);
  if (!swimRows.length) return [];

  const childById = new Map(childRows.map((c) => [c.id, c]));
  const childByPersonSeason = new Map(
    childRows.map((c) => [`${String(c.person_id ?? c.id)}|${String(c.season ?? "")}`, c]),
  );
  const byPerson = new Map<string, SwimHistoryReportRow>();

  for (const swim of swimRows) {
    const swimSeason = String(swim.season ?? "");
    const child = resolveChildForSwimHistoryRow(swim, childRows, childById, childByPersonSeason);
    if (!child) continue;

    const resolvedPersonId = String(swim.person_id ?? child.person_id ?? child.id);
    const rosterChild: RosterChild = {
      id: child.id,
      name: child.name,
      person_id: resolvedPersonId,
      group_name: child.group_name,
      leader: null,
    };
    const bracelet =
      swim.bracelet && typeof swim.bracelet === "object"
        ? braceletFromJson(rosterChild, swim.bracelet as Record<string, unknown>)
        : null;
    const levels =
      swim.levels && typeof swim.levels === "object"
        ? levelFromJson(rosterChild, swim.levels as Record<string, unknown>, swim.updated_at ?? undefined)
        : null;

    if (!swimHistoryRecordHasData(bracelet, levels)) continue;

    let row = byPerson.get(resolvedPersonId);
    if (!row) {
      row = { personId: resolvedPersonId, name: child.name, seasons: [] };
      byPerson.set(resolvedPersonId, row);
    }
    if (row.seasons.some((s) => s.season === swimSeason)) continue;

    row.seasons.push({
      season: swimSeason,
      childId: child.id,
      bracelet,
      levels,
    });
  }

  for (const row of byPerson.values()) {
    row.seasons.sort((a, b) => b.season.localeCompare(a.season));
  }

  return [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Distinct seasons with campers (for season selector). */
/** Division leader names for swim bracelet dropdowns — Airtable list + staff + saved data. */
export async function fetchSwimDivisionLeaderOptions(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<string[]> {
  const [{ data: staffRows }, { data: swimRows }] = await Promise.all([
    supabase
      .from("staff")
      .select("name, role")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("name"),
    supabase
      .from("swim_program_records")
      .select("bracelet")
      .eq("company_id", companyId)
      .eq("season", season),
  ]);

  const options: string[] = [...DIVISION_LEADER_OPTIONS];
  for (const row of staffRows ?? []) {
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    options.push(name);
    const role = String(row.role ?? "").toLowerCase();
    if (role.includes("division") || role.includes("leader")) {
      options.push(matchDivisionLeaderOption(name));
    }
  }
  for (const row of swimRows ?? []) {
    const bracelet = row.bracelet as Record<string, unknown> | null;
    const leader = String(bracelet?.divisionLeader ?? "").trim();
    if (leader) options.push(leader);
  }

  return mergeDivisionLeaderOptions(options);
}

/** Proctor initials / names for bracelet test dropdowns — staff roster + saved swim data. */
export async function fetchSwimProctorOptions(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<string[]> {
  const [{ data: staffRows }, { data: swimRows }] = await Promise.all([
    supabase
      .from("staff")
      .select("name")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("name"),
    supabase
      .from("swim_program_records")
      .select("bracelet")
      .eq("company_id", companyId)
      .eq("season", season),
  ]);

  const options: string[] = [...SWIM_PROCTOR_OPTIONS];
  for (const row of staffRows ?? []) {
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    options.push(name);
    const initials = staffNameToInitials(name);
    if (initials) options.push(initials);
  }
  for (const row of swimRows ?? []) {
    const bracelet = row.bracelet as Record<string, unknown> | null;
    if (!bracelet || typeof bracelet !== "object") continue;
    for (const key of ["proctor1", "proctor2", "proctor3", "proctor4", "proctor5"] as const) {
      const val = String(bracelet[key] ?? "").trim();
      if (val) options.push(val);
    }
  }

  return mergeProctorOptions([], options);
}

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

/** Assign the same division leader to many campers (batch upsert). */
export async function saveSwimBraceletsBulk(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  records: BraceletRecord[],
): Promise<void> {
  if (!records.length) return;
  const existingByChild = await loadExistingSwimRowsForSeason(supabase, companyId, season);
  const payloads = records.map((record) => {
    const existing = existingByChild.get(record.id);
    return {
      company_id: companyId,
      child_id: record.id,
      season,
      person_id: record.personId,
      bracelet: braceletToJson(record),
      levels: existing?.levels ?? {},
      source: existing?.source ?? "manual",
    };
  });

  for (let i = 0; i < payloads.length; i += SWIM_IMPORT_BATCH_SIZE) {
    const batch = payloads.slice(i, i + SWIM_IMPORT_BATCH_SIZE);
    const { error } = await supabase
      .from("swim_program_records")
      .upsert(batch, { onConflict: "company_id,child_id,season" });
    if (error) throw error;
  }
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

  const swimByChildSeason = new Map(
    (swimRows ?? []).map((r) => [`${r.child_id as string}|${String(r.season ?? "")}`, r]),
  );

  const history: SwimSeasonHistory[] = [];
  for (const child of childRows) {
    const childSeason = String(child.season ?? "");
    const swim =
      swimByChildSeason.get(`${child.id}|${childSeason}`) ??
      (swimRows ?? []).find(
        (r) => String(r.season) === childSeason && String(r.person_id ?? "") === personId,
      );
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
    if (!swimHistoryRecordHasData(bracelet, levels)) continue;

    history.push({
      season: String(swim?.season ?? childSeason ?? "—"),
      childId: child.id,
      childName: child.name,
      bracelet,
      levels,
    });
  }

  for (const swim of swimRows ?? []) {
    const swimSeason = String(swim.season ?? "");
    if (history.some((h) => h.season === swimSeason && h.childId === swim.child_id)) continue;
    const child = childRows.find((c) => c.id === swim.child_id);
    if (!child) continue;
    const rosterChild: RosterChild = {
      id: child.id,
      name: child.name,
      person_id: personId,
      group_name: null,
      leader: null,
    };
    const bracelet =
      swim.bracelet && typeof swim.bracelet === "object"
        ? braceletFromJson(rosterChild, swim.bracelet as Record<string, unknown>)
        : null;
    const levels =
      swim.levels && typeof swim.levels === "object"
        ? levelFromJson(rosterChild, swim.levels as Record<string, unknown>, swim.updated_at ?? undefined)
        : null;
    if (!swimHistoryRecordHasData(bracelet, levels)) continue;
    history.push({
      season: swimSeason,
      childId: child.id,
      childName: child.name,
      bracelet,
      levels,
    });
  }

  return history.sort((a, b) => b.season.localeCompare(a.season));
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
    .replace(/[''`.]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

export function isAirtableSwimRecordsCsv(headers: string[]): boolean {
  const normalized = headers.map(normHeader);
  const hasChild = normalized.some((h) => h.includes("child") && h.includes("name"));
  const hasGoldfish = normalized.some((h) => h.startsWith("goldfish_1a"));
  return hasChild && hasGoldfish;
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

const EXIT_SKILL_HEADER_MAP: Record<string, number> = {
  exit_skill_1: 0,
  exit_skill_2: 1,
  exit_skills_1: 0,
  exit_skills_2: 1,
  exit1: 0,
  exit2: 1,
};

function resolveExitSkillHeader(h: string): number | null {
  const n = normHeader(h);
  if (n in EXIT_SKILL_HEADER_MAP) return EXIT_SKILL_HEADER_MAP[n]!;
  const m = n.match(/^exit(?:_skill)?s?[_ ]?([12])$/);
  if (m) return Number(m[1]) - 1;
  return null;
}

const LEVEL_HEADER_MAP: Partial<Record<string, keyof LevelRecord>> = {
  goldfish_level: "goldfishLevel",
  minnow_level: "minnowLevel",
  tadpole_level: "tadpoleLevel",
  red_cross_level_1: "redCross",
  red_cross_level_2: "redCross2",
  red_cross_level_3: "redCross3",
  red_class_level_3: "redCross3",
  frog_level: "frog",
};

function buildSwimChildIndex(children: RosterChild[], defaultSeason: string) {
  const byId = new Map<string, RosterChild>();
  const bySeasonName = new Map<string, RosterChild>();
  const bySeasonPerson = new Map<string, RosterChild>();
  const byPersonId = new Map<string, RosterChild>();

  for (const c of children) {
    const season = String(c.season ?? "");
    byId.set(c.id, c);
    bySeasonName.set(`${season}|${c.name.trim().toLowerCase()}`, c);
    bySeasonPerson.set(`${season}|${c.person_id}`, c);

    const existing = byPersonId.get(c.person_id);
    if (!existing || (season === defaultSeason && String(existing.season) !== defaultSeason)) {
      byPersonId.set(c.person_id, c);
    }
  }
  return { byId, bySeasonName, bySeasonPerson, byPersonId };
}

function findNameColumnIndex(headers: string[]): number {
  return headers.findIndex(
    (h) =>
      h === "name" ||
      h === "child_name" ||
      h === "childs_name" ||
      h === "camper" ||
      (h.includes("child") && h.includes("name")),
  );
}

function findPersonColumnIndex(headers: string[]): number {
  return headers.findIndex(
    (h) => h === "person_id" || h === "campminder_id" || h === "personid",
  );
}

function resolveChildForImportRow(
  cols: string[],
  headers: string[],
  index: ReturnType<typeof buildSwimChildIndex>,
  importSeason: string,
): RosterChild | null {
  const nameIdx = findNameColumnIndex(headers);
  const childIdIdx = headers.findIndex((h) => h === "child_id" || h === "id");
  const personIdx = findPersonColumnIndex(headers);

  const childId = childIdIdx >= 0 ? cols[childIdIdx]?.trim() : "";
  const personId = personIdx >= 0 ? cols[personIdx]?.trim() : "";
  const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";

  if (childId && index.byId.has(childId)) {
    const c = index.byId.get(childId)!;
    if (!importSeason || String(c.season) === importSeason) return c;
  }
  if (personId) {
    const seasonHit = index.bySeasonPerson.get(`${importSeason}|${personId}`);
    if (seasonHit) return seasonHit;
    const anySeason = index.byPersonId.get(personId);
    if (anySeason) return anySeason;
  }
  if (name) {
    const seasonHit = index.bySeasonName.get(`${importSeason}|${name.toLowerCase()}`);
    if (seasonHit) return seasonHit;
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
  const nameIdx = findNameColumnIndex(headers);
  const seasonIdx = headers.findIndex((h) => h === "season" || h === "year");
  const groupIdx = headers.findIndex((h) => h === "group");

  const index = buildSwimChildIndex(children, defaultSeason);
  const rows: SwimCsvImportRow[] = [];
  const unmatched: string[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    const importSeason = (seasonIdx >= 0 ? cols[seasonIdx]?.trim() : "") || defaultSeason;
    const child = resolveChildForImportRow(cols, headers, index, importSeason);
    const name = nameIdx >= 0 ? cols[nameIdx]?.trim() : "";
    const csvGroup = groupIdx >= 0 ? cols[groupIdx]?.trim() : "";

    if (!child) {
      if (name) unmatched.push(importSeason ? `${name} (${importSeason})` : name);
      continue;
    }

    const importRow: SwimCsvImportRow = { child, season: importSeason };

    if (braceletIdx >= 0) {
      const color = cols[braceletIdx]?.trim();
      const normalizedColor = normalizeBraceletColor(color);
      if (normalizedColor) {
        importRow.bracelet = {
          currentBracelet: normalizedColor,
          ...(csvGroup ? { group: csvGroup } : {}),
        };
      }
    }

    const goldfish = emptySkills4();
    const minnow = emptySkills6();
    const tadpole = emptySkills4();
    const exitSkills = emptyExitSkills();
    const levelFields: Partial<LevelRecord> = {};
    let hasSkill = false;
    let hasLevelField = false;

    headers.forEach((h, idx) => {
      const skillMap = resolveSkillHeader(h);
      if (skillMap) {
        const val = normalizeSkillStatus(cols[idx]);
        if (val !== "—") hasSkill = true;
        if (skillMap.group === "goldfish") goldfish[skillMap.index] = val;
        if (skillMap.group === "minnow") minnow[skillMap.index] = val;
        if (skillMap.group === "tadpole") tadpole[skillMap.index] = val;
        return;
      }

      const exitIdx = resolveExitSkillHeader(h);
      if (exitIdx !== null && exitIdx >= 0 && exitIdx < EXIT_SKILL_COUNT) {
        const val = normalizeSkillStatus(cols[idx]);
        if (val !== "—") hasSkill = true;
        exitSkills[exitIdx] = val;
        return;
      }

      const levelKey = LEVEL_HEADER_MAP[h];
      if (!levelKey) return;
      const val = normalizeLevelStatus(cols[idx]);
      if (val === "—") return;
      (levelFields as Record<string, LevelStatus>)[levelKey] = val;
      hasLevelField = true;
    });

    if (hasSkill || hasLevelField) {
      importRow.levels = {
        goldfish,
        goldfishLevel:
          levelFields.goldfishLevel ??
          (hasSkill ? levelFromSkills(goldfish) : "—"),
        minnow,
        minnowLevel:
          levelFields.minnowLevel ??
          (hasSkill ? levelFromSkills(minnow) : "—"),
        tadpole,
        tadpoleLevel:
          levelFields.tadpoleLevel ??
          (hasSkill ? levelFromSkills(tadpole) : "—"),
        redCross: levelFields.redCross ?? "—",
        redCross2: levelFields.redCross2 ?? "—",
        redCross3: levelFields.redCross3 ?? "—",
        redCross4: levelFields.redCross4 ?? "—",
        frog: levelFields.frog ?? "—",
        exitSkills,
        ...(csvGroup ? { group: csvGroup } : {}),
      };
    }

    if (importRow.bracelet || importRow.levels) rows.push(importRow);
  }

  return { rows, unmatched };
}

export type SwimImportProgress = {
  phase: "parsing" | "matching" | "saving";
  current: number;
  total: number;
  message: string;
};

const SWIM_IMPORT_BATCH_SIZE = 50;

type MergedImportRow = {
  child: RosterChild;
  season: string;
  bracelet?: Partial<BraceletRecord>;
  levels?: Partial<LevelRecord>;
};

function mergeImportRows(parsed: SwimCsvImportRow[]): MergedImportRow[] {
  const byKey = new Map<string, MergedImportRow>();
  for (const row of parsed) {
    const key = `${row.season}|${row.child.id}`;
    const prev = byKey.get(key) ?? { child: row.child, season: row.season };
    if (row.bracelet) prev.bracelet = { ...prev.bracelet, ...row.bracelet };
    if (row.levels) prev.levels = { ...prev.levels, ...row.levels };
    byKey.set(key, prev);
  }
  return [...byKey.values()];
}

async function loadExistingSwimRowsForSeason(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<Map<string, { bracelet: Record<string, unknown>; levels: Record<string, unknown>; source: string }>> {
  const map = new Map<
    string,
    { bracelet: Record<string, unknown>; levels: Record<string, unknown>; source: string }
  >();
  const { data, error } = await supabase
    .from("swim_program_records")
    .select("child_id, bracelet, levels, source")
    .eq("company_id", companyId)
    .eq("season", season);
  if (error) {
    if (isSwimTableMissingError(error)) return map;
    throw error;
  }
  for (const row of data ?? []) {
    map.set(String(row.child_id), {
      bracelet: (row.bracelet as Record<string, unknown>) ?? {},
      levels: (row.levels as Record<string, unknown>) ?? {},
      source: String(row.source ?? "manual"),
    });
  }
  return map;
}

/** Import parsed CSV rows into swim_program_records (supports prior seasons). */
export async function importSwimProgramRows(
  supabase: SupabaseClient,
  companyId: string,
  parsed: SwimCsvImportRow[],
  onProgress?: (progress: SwimImportProgress) => void,
): Promise<{ bracelets: number; levels: number }> {
  const merged = mergeImportRows(parsed);
  let bracelets = 0;
  let levels = 0;
  if (!merged.length) return { bracelets, levels };

  const bySeason = new Map<string, MergedImportRow[]>();
  for (const row of merged) {
    const list = bySeason.get(row.season) ?? [];
    list.push(row);
    bySeason.set(row.season, list);
  }

  let saved = 0;
  const total = merged.length;

  for (const [season, rows] of bySeason) {
    onProgress?.({
      phase: "saving",
      current: saved,
      total,
      message: `Loading existing ${season} records…`,
    });
    const existingByChild = await loadExistingSwimRowsForSeason(supabase, companyId, season);
    const payloads: Record<string, unknown>[] = [];

    for (const row of rows) {
      const existing = existingByChild.get(row.child.id);
      const hasBracelet = Boolean(row.bracelet);
      const hasLevels = Boolean(row.levels);
      if (hasBracelet) bracelets++;
      if (hasLevels) levels++;

      const braceletRecord = hasBracelet
        ? { ...braceletFromChild(row.child), ...row.bracelet }
        : null;
      const levelRecord = hasLevels
        ? { ...levelFromChild(row.child), ...row.levels, lastModified: "Imported" }
        : null;

      payloads.push({
        company_id: companyId,
        child_id: row.child.id,
        season,
        person_id: row.child.person_id,
        bracelet: braceletRecord ? braceletToJson(braceletRecord) : (existing?.bracelet ?? {}),
        levels: levelRecord ? levelToJson(levelRecord) : (existing?.levels ?? {}),
        source: existing?.source ?? "airtable",
      });
    }

    for (let i = 0; i < payloads.length; i += SWIM_IMPORT_BATCH_SIZE) {
      const batch = payloads.slice(i, i + SWIM_IMPORT_BATCH_SIZE);
      const { error } = await supabase
        .from("swim_program_records")
        .upsert(batch, { onConflict: "company_id,child_id,season" });
      if (error) throw error;
      saved = Math.min(saved + batch.length, total);
      onProgress?.({
        phase: "saving",
        current: saved,
        total,
        message: `Saving ${saved} of ${total} campers…`,
      });
    }
  }

  return { bracelets, levels };
}

export async function importSwimProgramCsv(
  supabase: SupabaseClient,
  companyId: string,
  csvText: string,
  defaultSeason: string,
  onProgress?: (progress: SwimImportProgress) => void,
): Promise<{
  bracelets: number;
  levels: number;
  unmatched: string[];
  csvRows: number;
  matched: number;
  seasons: string[];
}> {
  onProgress?.({
    phase: "parsing",
    current: 0,
    total: 1,
    message: "Reading CSV…",
  });
  const children = await fetchAllSwimRosterChildren(supabase, companyId);
  onProgress?.({
    phase: "matching",
    current: 0,
    total: 1,
    message: `Matching campers to roster (${children.length} on file)…`,
  });
  const { rows, unmatched } = parseSwimProgramCsv(csvText, children, defaultSeason);
  const counts = await importSwimProgramRows(supabase, companyId, rows, onProgress);
  const seasons = [...new Set(rows.map((r) => r.season))].sort((a, b) => b.localeCompare(a));
  return { ...counts, unmatched, csvRows: rows.length, matched: rows.length, seasons };
}

export function swimProgramCsvTemplate(): string {
  return [
    "Season,Child's Name,Group,PersonID,current_bracelet,Goldfish 1A1,Goldfish 1A2,Goldfish 1A3,Goldfish 1A4,Goldfish Level,Minnow 1B1,Minnow 1B2,Minnow 1B3,Minnow 1B4,Minnow 1B5,Minnow 1B6,Minnow Level,Tadpole 1C1,Tadpole 1C2,Tadpole 1C3,Tadpole 1C4,Tadpole Level,Red Cross Level 1,Frog Level",
    "2026,Jane Doe,Syracuse,12345678,Orange,Achieved,Achieved,Working Towards,—,Incomplete,A,—,—,—,—,—,—,—,—,—,—,—,—,—,—",
    "2027,Jane Doe,Syracuse,12345678,Green,A,A,A,A,Complete,A,A,A,A,A,A,Complete,—,—,—,—,—,—,—",
  ].join("\n");
}
