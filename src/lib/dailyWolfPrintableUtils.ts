import { formatTime12Hour } from "@/lib/utils";

type NamedDivision = { id?: string; name?: string | null };

/** 12-hour display for Daily Wolf printables; never falls back to raw 24-hour strings. */
export function formatPrintableTime(raw?: string | null): string {
  if (!raw?.trim()) return "TBD";
  const formatted = formatTime12Hour(raw.trim());
  return formatted || "TBD";
}

export function mergeActivityDivisions(event: {
  division?: NamedDivision | null;
  special_events_divisions?: { division?: NamedDivision | null }[] | null;
}): NamedDivision[] {
  const fromJunction =
    event.special_events_divisions?.map((row) => row.division).filter(Boolean) ?? [];
  const legacy = event.division ? [event.division] : [];
  const byId = new Map<string, NamedDivision>();
  for (const div of [...fromJunction, ...legacy] as NamedDivision[]) {
    if (!div?.name) continue;
    byId.set(div.id ?? div.name, div);
  }
  return [...byId.values()];
}

export function mergeSportsDivisions(event: {
  sports_calendar_divisions?: { division?: NamedDivision | null }[] | null;
}): NamedDivision[] {
  const fromJunction =
    event.sports_calendar_divisions?.map((row) => row.division).filter(Boolean) ?? [];
  const byId = new Map<string, NamedDivision>();
  for (const div of fromJunction as NamedDivision[]) {
    if (!div?.name) continue;
    byId.set(div.id ?? div.name, div);
  }
  return [...byId.values()];
}

export function divisionNamesLabel(divisions: NamedDivision[]): string {
  return divisions.map((d) => d.name).filter(Boolean).join(", ");
}
