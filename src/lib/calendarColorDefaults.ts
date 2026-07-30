/** Shared calendar color defaults — keep in sync with module pages + Master Calendar. */

export const ACTIVITIES_FIELD_TRIPS_CALENDAR_COLORS: Record<string, string> = {
  "Teen Trip": "#6b7280",
  "Collegiate Trip": "#14b8a6",
  "Senior Trip": "#7f1d1d",
  "Junior Trip": "#9333ea",
  Olympics: "#000000",
  "Wacky Wednesday": "#000000",
  Default: "#22c55e",
  "field-trip": "#22c55e",
  "arts-crafts": "#ec4899",
  nature: "#16a34a",
  water: "#0ea5e9",
  outdoor: "#d97706",
  cultural: "#8b5cf6",
  "staff-bus": "#6b7280",
  "sporting-event": "#3b82f6",
  other: "#64748b",
};

export const SPECIAL_EVENTS_CALENDAR_COLORS: Record<string, string> = {
  "special-event": "#3b82f6",
  "evening-activity": "#8b5cf6",
  "rookie-day": "#22c55e",
  tour: "#000000",
  "divisional-night": "#bf00ff",
  "campus-night": "#4d4dff",
  "full-camp": "#ff6600",
  campfire: "#f59e0b",
  "movie-night": "#6366f1",
  "talent-show": "#ec4899",
  "game-night": "#14b8a6",
  other: "#6b7280",
  Olympics: "#000000",
  "Wacky Wednesday": "#000000",
  "Divisional Night": "#bf00ff",
  "Campus Night": "#4d4dff",
  "Full Camp": "#ff6600",
  "Rookie Day": "#22c55e",
  Tour: "#000000",
};

export const SPORTS_CALENDAR_COLORS: Record<string, string> = {
  Away: "#1e3a5f",
  Home: "#166534",
  "Away (Sports)": "#1e3a5f",
  "Home (Sports)": "#166534",
  Gordon: "#39ff14",
  Jacobs: "#39ff14",
  "Bocian/Melter Bowl": "#39ff14",
  "No Roster": "#ef4444",
  "Has Roster": "#22c55e",
  "Sports (Default)": "#3b82f6",
};

export const TIGER_TIMES_CALENDAR_COLORS: Record<string, string> = {
  "TT: Laundry": "#3b82f6",
  "TT: Phone Calls": "#ef4444",
  "TT: Movie / Entertainment": "#eab308",
  "TT: Outside Events": "#eab308",
  "TT: Staff Days Off": "#93c5fd",
  "TT: OD Notes": "#ec4899",
  "Tiger Times (Default)": "#f59e0b",
};

export const DAILY_WOLF_CALENDAR_COLORS: Record<string, string> = {
  "DW: Super OD": "#6366f1",
  "DW: Quote": "#d97706",
  "DW: Laundry": "#3b82f6",
  "DW: Phone Calls": "#ef4444",
  "DW: Notes": "#a855f7",
  "Daily Wolf (Default)": "#0ea5e9",
};

/** Base defaults for Master Calendar (all camps). */
export const DEFAULT_MASTER_CALENDAR_COLORS: Record<string, string> = {
  "Sports (Default)": "#3b82f6",
  "Field Trip (Default)": "#22c55e",
  "Special Event (Default)": "#a855f7",
  "Tiger Times (Default)": "#f59e0b",
  "Daily Wolf (Default)": "#0ea5e9",
  ...ACTIVITIES_FIELD_TRIPS_CALENDAR_COLORS,
  ...SPECIAL_EVENTS_CALENDAR_COLORS,
  ...SPORTS_CALENDAR_COLORS,
  ...TIGER_TIMES_CALENDAR_COLORS,
  ...DAILY_WOLF_CALENDAR_COLORS,
};

export const CALENDAR_COLOR_STORAGE_IDS = [
  "sports-calendar",
  "activities-field-trips",
  "special-events",
  "tiger-times",
] as const;

/** Full palette: module defaults + any per-browser overrides from individual calendar pages. */
export function loadMergedCalendarColors(): Record<string, string> {
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
