import type { SunshineTagSeed } from "@/lib/sunshineReportOptions";

function pickFirstNormalized(row: Record<string, string>, keys: string[]): string {
  const normalized = new Map<string, string>();
  for (const [key, value] of Object.entries(row)) {
    normalized.set(key.trim().toLowerCase(), value);
  }
  for (const key of keys) {
    const value = normalized.get(key.trim().toLowerCase());
    if (value?.trim()) return value;
  }
  return "";
}

export function parseMultiSelect(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseAirtableYesNo(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return null;
}

export function parseAirtableSendEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === "checked" || normalized === "yes" || normalized === "true" || normalized === "1";
}

export function isAirtableSunshineCsv(rows: Record<string, string>[]): boolean {
  if (rows.length === 0) return false;
  const headers = Object.keys(rows[0]).map((key) => key.trim().toLowerCase());
  const hasChild = headers.some((key) => key.includes("child") && key.includes("name"));
  const hasSports = headers.some((key) => key === "sports" || key.includes("sport"));
  const hasLunch = headers.some((key) => key === "lunch");
  return hasChild && hasSports && hasLunch;
}

export type ParsedAirtableSunshineRow = {
  childName: string;
  groupName: string;
  sports: string[];
  activities: string[];
  lunch: string[];
  bm: boolean | null;
  napped: boolean | null;
  sendEmail: boolean;
};

export function parseAirtableSunshineRow(row: Record<string, string>): ParsedAirtableSunshineRow | null {
  const childName = pickFirstNormalized(row, ["child's name", "child name", "childs name", "full name", "name"]).trim();
  if (!childName) return null;

  return {
    childName,
    groupName: pickFirstNormalized(row, ["group", "group name", "cabin"]).trim(),
    sports: parseMultiSelect(pickFirstNormalized(row, ["sports", "sport"])),
    activities: parseMultiSelect(pickFirstNormalized(row, ["activities", "activity"])),
    lunch: parseMultiSelect(pickFirstNormalized(row, ["lunch"])),
    bm: parseAirtableYesNo(pickFirstNormalized(row, ["bm", "b.m."])),
    napped: parseAirtableYesNo(pickFirstNormalized(row, ["napped?", "napped", "nap"])),
    sendEmail: parseAirtableSendEmail(pickFirstNormalized(row, ["send email", "send_email"])),
  };
}

export function collectSunshineTagSeedsFromRows(
  rows: ParsedAirtableSunshineRow[],
  colorByCategory: Record<string, string[]>,
): SunshineTagSeed[] {
  const seeds: SunshineTagSeed[] = [];
  const seen = new Set<string>();

  const add = (category: SunshineTagSeed["category"], label: string) => {
    const key = `${category}:${label}`;
    if (!label || seen.has(key)) return;
    seen.add(key);
    const palette = colorByCategory[category];
    seeds.push({
      category,
      label,
      color: palette[seeds.filter((s) => s.category === category).length % palette.length] ?? "gray",
      sort_order: seeds.filter((s) => s.category === category).length,
    });
  };

  for (const row of rows) {
    row.sports.forEach((label) => add("sport", label));
    row.activities.forEach((label) => add("activity", label));
    row.lunch.forEach((label) => add("lunch", label));
  }

  return seeds;
}

export const SUNSHINE_TAG_COLOR_PALETTE = {
  sport: ["teal", "blue", "green", "orange", "purple"],
  activity: ["pink", "purple", "yellow", "blue", "green"],
  lunch: ["orange", "yellow", "green", "pink", "teal"],
} as const;

export function normalizeSunshineName(value: string): string {
  return value.trim().toLowerCase();
}
