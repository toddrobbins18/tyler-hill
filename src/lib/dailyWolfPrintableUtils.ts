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

const PLACEHOLDER_TIME_VALUES = new Set(["", "tbd", "all day", "n/a"]);

function isPlaceholderTime(raw?: string | null): boolean {
  return PLACEHOLDER_TIME_VALUES.has((raw || "").trim().toLowerCase());
}

function formatTimeSlotForDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const formatted = parts.map((p) => formatTime12Hour(p)).filter(Boolean);
      if (formatted.length >= 2) return `${formatted[0]} – ${formatted[1]}`;
    }
  }
  const formatted = formatTime12Hour(trimmed);
  return formatted && !isPlaceholderTime(formatted) ? formatted : "";
}

function resolveEventTimeRaw(event: {
  time_slot?: string | null;
  time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}): string {
  const slot = (event.time_slot || "").trim();
  if (slot && !isPlaceholderTime(slot)) return slot;

  const start = (event.start_time || "").trim();
  const end = (event.end_time || "").trim();
  if (start && end) return `${start} - ${end}`;
  if (start) return start;
  if (end) return end;

  const legacy = (event.time || "").trim();
  if (legacy && !isPlaceholderTime(legacy)) return legacy;
  return "";
}

/** Dashboard special-events subtitle: 12-hour time and assigned division(s) when present. */
export function formatDashboardSpecialEventSubtitle(event: {
  time_slot?: string | null;
  time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  divisions?: NamedDivision[];
  division?: NamedDivision | null;
  special_events_divisions?: { division?: NamedDivision | null }[] | null;
}): string {
  const parts: string[] = [];

  const rawTime = resolveEventTimeRaw(event);
  if (rawTime) {
    const displayTime = formatTimeSlotForDisplay(rawTime);
    if (displayTime) parts.push(displayTime);
  }

  const divisions =
    event.divisions && event.divisions.length > 0
      ? event.divisions
      : mergeActivityDivisions(event);
  const label = divisionNamesLabel(divisions);
  if (label) parts.push(label);

  if (parts.length === 0) return "All divisions";
  return parts.join(" • ");
}
