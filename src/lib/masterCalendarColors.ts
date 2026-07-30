export type MasterCalendarEventSource =
  | "sports_calendar"
  | "activities_field_trips"
  | "special_events_activities"
  | "tiger_times"
  | "daily_wolf";

/** Default event colors — shared across all camps (Tyler Hill, North Shore, etc.). */
export const DEFAULT_MASTER_CALENDAR_COLORS: Record<string, string> = {
  "Sports (Default)": "#3b82f6",
  "Field Trip (Default)": "#22c55e",
  "Special Event (Default)": "#a855f7",
  "Tiger Times (Default)": "#f59e0b",
  "Daily Wolf (Default)": "#0ea5e9",
  "field-trip": "#22c55e",
  "arts-crafts": "#ec4899",
  nature: "#16a34a",
  water: "#0ea5e9",
  outdoor: "#d97706",
  cultural: "#8b5cf6",
  "staff-bus": "#6b7280",
  "sporting-event": "#3b82f6",
  other: "#64748b",
  "Teen Trip": "#6b7280",
  "Collegiate Trip": "#14b8a6",
  "Senior Trip": "#7f1d1d",
  "Junior Trip": "#9333ea",
  Olympics: "#000000",
  "Wacky Wednesday": "#000000",
  "Divisional Night": "#bf00ff",
  "Campus Night": "#4d4dff",
  "Full Camp": "#ff6600",
  "Rookie Day": "#22c55e",
  Tour: "#000000",
  "Away (Sports)": "#1e3a5f",
  "Home (Sports)": "#166534",
  Gordon: "#39ff14",
  Jacobs: "#39ff14",
  "Bocian/Melter Bowl": "#39ff14",
  "TT: Laundry": "#3b82f6",
  "TT: Phone Calls": "#ef4444",
  "TT: Movie / Entertainment": "#eab308",
  "TT: Outside Events": "#eab308",
  "TT: Staff Days Off": "#93c5fd",
  "TT: OD Notes": "#ec4899",
  "DW: Super OD": "#6366f1",
  "DW: Quote": "#d97706",
  "DW: Laundry": "#3b82f6",
  "DW: Phone Calls": "#ef4444",
  "DW: Notes": "#a855f7",
};

const SOURCE_DEFAULTS: Record<MasterCalendarEventSource, string> = {
  sports_calendar: DEFAULT_MASTER_CALENDAR_COLORS["Sports (Default)"],
  activities_field_trips: DEFAULT_MASTER_CALENDAR_COLORS["Field Trip (Default)"],
  special_events_activities: DEFAULT_MASTER_CALENDAR_COLORS["Special Event (Default)"],
  tiger_times: DEFAULT_MASTER_CALENDAR_COLORS["Tiger Times (Default)"],
  daily_wolf: DEFAULT_MASTER_CALENDAR_COLORS["Daily Wolf (Default)"],
};

const CALENDAR_COLOR_STORAGE_IDS = [
  "sports-calendar",
  "activities-field-trips",
  "special-events",
  "tiger-times",
] as const;

/** Merge module-level color overrides from localStorage (same for every camp). */
export function loadMasterCalendarColors(): Record<string, string> {
  const merged = { ...DEFAULT_MASTER_CALENDAR_COLORS };
  for (const id of CALENDAR_COLOR_STORAGE_IDS) {
    try {
      const stored = localStorage.getItem(`calendar-colors-${id}`);
      if (stored) Object.assign(merged, JSON.parse(stored));
    } catch {
      /* ignore corrupt localStorage */
    }
  }
  return merged;
}

export function resolveMasterCalendarColor(
  source: MasterCalendarEventSource,
  customColors: Record<string, string>,
  originalData?: Record<string, unknown> | null,
): string {
  const subCategory = originalData?.sub_category as string | undefined;
  const eventType = (originalData?.event_type || originalData?.activity_type) as string | undefined;
  const homeAway = originalData?.home_away as string | undefined;

  let bgColor: string | undefined;
  if (subCategory && customColors[subCategory]) bgColor = customColors[subCategory];
  if (!bgColor && eventType && customColors[eventType]) bgColor = customColors[eventType];

  if (source === "sports_calendar" && (homeAway === "away" || eventType === "Away")) {
    bgColor = customColors["Away (Sports)"];
  }
  if (source === "sports_calendar" && (homeAway === "home" || eventType === "Home")) {
    bgColor = customColors["Home (Sports)"];
  }
  if (
    source === "sports_calendar" &&
    eventType &&
    ["Gordon", "Jacobs", "Bocian/Melter Bowl"].includes(eventType)
  ) {
    bgColor = customColors[eventType];
  }

  if (source === "tiger_times") {
    const ttCategory = originalData?.tiger_times_category as string | undefined;
    if (ttCategory && customColors[ttCategory]) bgColor = customColors[ttCategory];
  }
  if (source === "daily_wolf") {
    const dwCategory = originalData?.daily_wolf_category as string | undefined;
    if (dwCategory && customColors[dwCategory]) bgColor = customColors[dwCategory];
  }

  return bgColor || SOURCE_DEFAULTS[source] || "#6b7280";
}

export const MASTER_CALENDAR_VIEW_STORAGE_KEY = "nest-master-calendar-view";

export function readStoredMasterCalendarView(): "month" | "week" | "day" | "agenda" {
  try {
    const stored = localStorage.getItem(MASTER_CALENDAR_VIEW_STORAGE_KEY);
    if (stored === "month" || stored === "week" || stored === "day" || stored === "agenda") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "week";
}

export function storeMasterCalendarView(view: string) {
  try {
    localStorage.setItem(MASTER_CALENDAR_VIEW_STORAGE_KEY, view);
  } catch {
    /* ignore */
  }
}
