export type MasterCalendarEventSource =
  | "sports_calendar"
  | "activities_field_trips"
  | "special_events_activities"
  | "tiger_times"
  | "daily_wolf";

import {
  DEFAULT_MASTER_CALENDAR_COLORS,
} from "./calendarColorDefaults";

export {
  DEFAULT_MASTER_CALENDAR_COLORS,
  loadMergedCalendarColors as loadMasterCalendarColors,
} from "./calendarColorDefaults";

const SOURCE_DEFAULTS: Record<MasterCalendarEventSource, string> = {
  sports_calendar: DEFAULT_MASTER_CALENDAR_COLORS["Sports (Default)"],
  activities_field_trips: DEFAULT_MASTER_CALENDAR_COLORS["Field Trip (Default)"],
  special_events_activities: DEFAULT_MASTER_CALENDAR_COLORS["Special Event (Default)"],
  tiger_times: DEFAULT_MASTER_CALENDAR_COLORS["Tiger Times (Default)"],
  daily_wolf: DEFAULT_MASTER_CALENDAR_COLORS["Daily Wolf (Default)"],
};

export function resolveMasterCalendarColor(
  source: MasterCalendarEventSource,
  customColors: Record<string, string>,
  originalData?: Record<string, unknown> | null,
): string {
  const subCategory = originalData?.sub_category as string | undefined;
  const eventType = (
    originalData?.event_type ||
    originalData?.activity_type ||
    originalData?.sport_type
  ) as string | undefined;
  const homeAway = originalData?.home_away as string | undefined;

  let bgColor: string | undefined;

  if (source === "activities_field_trips") {
    const activityKey = subCategory || eventType;
    if (activityKey && customColors[activityKey]) bgColor = customColors[activityKey];
    if (!bgColor && customColors.Default) bgColor = customColors.Default;
  } else if (source === "special_events_activities") {
    if (subCategory && customColors[subCategory]) bgColor = customColors[subCategory];
    if (!bgColor && eventType && customColors[eventType]) bgColor = customColors[eventType];
  } else if (source === "sports_calendar") {
    if (homeAway === "away" || eventType === "Away") {
      bgColor = customColors["Away (Sports)"] || customColors.Away;
    } else if (homeAway === "home" || eventType === "Home") {
      bgColor = customColors["Home (Sports)"] || customColors.Home;
    } else if (eventType && ["Gordon", "Jacobs", "Bocian/Melter Bowl"].includes(eventType)) {
      bgColor = customColors[eventType];
    } else if (eventType && customColors[eventType]) {
      bgColor = customColors[eventType];
    }
  } else {
    if (subCategory && customColors[subCategory]) bgColor = customColors[subCategory];
    if (!bgColor && eventType && customColors[eventType]) bgColor = customColors[eventType];
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

export function getMasterCalendarEventStyle(
  source: MasterCalendarEventSource,
  customColors: Record<string, string>,
  originalData?: Record<string, unknown> | null,
): { backgroundColor: string; color: string } {
  const backgroundColor = resolveMasterCalendarColor(source, customColors, originalData);
  const isNeonGreen = backgroundColor === "#39ff14";
  const isDark = backgroundColor === "#000000" || backgroundColor === "#7f1d1d";
  return {
    backgroundColor,
    color: isNeonGreen ? "#000000" : isDark ? "#ffffff" : "#ffffff",
  };
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
