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

/** Dashboard special-events subtitle: 12-hour time when set, otherwise assigned division(s). */
export function formatDashboardSpecialEventSubtitle(event: {
  time_slot?: string | null;
  time?: string | null;
  divisions?: NamedDivision[];
  division?: NamedDivision | null;
  special_events_divisions?: { division?: NamedDivision | null }[] | null;
}): string {
  const rawTime = (event.time_slot || event.time || "").trim();
  if (rawTime && !isPlaceholderTime(rawTime)) {
    const displayTime = formatTimeSlotForDisplay(rawTime);
    if (displayTime) return displayTime;
  }

  const divisions =
    event.divisions && event.divisions.length > 0
      ? event.divisions
      : mergeActivityDivisions(event);
  const label = divisionNamesLabel(divisions);
  return label || "All divisions";
}
