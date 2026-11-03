/** Group activity schedules: scanned periods and “where is this group at this time?” */

export const SCHEDULE_DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type GroupScheduleDraft = {
  groupName: string;
  /** 0 = Sunday … 6 = Saturday. Null when the row is a calendar-date override only. */
  dayOfWeek: number | null;
  /** YYYY-MM-DD when this row replaces the weekly template for one date. */
  appliesOn: string | null;
  startMinutes: number;
  endMinutes: number;
  activity: string;
  location: string;
  /** 1 or 2 when the file is a two-week rotation. Null applies every week. */
  rotationWeek?: 1 | 2 | null;
};

export type GroupScheduleSlot = GroupScheduleDraft & {
  id: string;
  uploadId: string;
};

export function dayOfWeekFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "Bunnies - SS3" and "Honolulu CREW GIRLS" match the roster group. */
export function scheduleGroupName(raw: string): string {
  let name = raw.trim().replace(/\s+/g, " ");
  const beforeDash = name.split(/\s*-\s*/)[0]?.trim() ?? "";
  if (beforeDash.length >= 2 && beforeDash !== name) name = beforeDash;
  name = name.replace(/\s+crew\b.*$/i, "").trim();
  return name || raw.trim();
}

const WEEK_LOCATION = /^week\s*([12])$/i;

export function rotationWeekFromLocation(location: string): 1 | 2 | null {
  const match = WEEK_LOCATION.exec(location.trim());
  if (!match) return null;
  return match[1] === "1" ? 1 : 2;
}

/** Odd camp weeks use schedule week 1. Even camp weeks use schedule week 2. */
export function scheduleRotationWeek(campWeek: number | null | undefined): 1 | 2 | null {
  if (campWeek == null || campWeek < 1) return null;
  return campWeek % 2 === 1 ? 1 : 2;
}

/** Camp week 1 is the Monday-start week that contains the program start date. */
export function campWeekNumber(ymd: string, campStartYmd: string): number {
  const monday = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    const utc = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
    const dow = new Date(utc).getUTCDay();
    const offset = dow === 0 ? -6 : 1 - dow;
    return utc + offset * 86_400_000;
  };
  const diffDays = Math.round((monday(ymd) - monday(campStartYmd)) / 86_400_000);
  const week = Math.floor(diffDays / 7) + 1;
  return week < 1 ? 1 : week;
}

export function scheduleLocationForSave(slot: GroupScheduleDraft): string {
  const place = slot.location.trim();
  if (place && !rotationWeekFromLocation(place)) return place;
  if (slot.rotationWeek === 1 || slot.rotationWeek === 2) return `Week ${slot.rotationWeek}`;
  return "";
}

export function sameScheduleLabel(a: string, b: string): boolean {
  return scheduleGroupName(a).toLowerCase() === scheduleGroupName(b).toLowerCase();
}

/** Clock text, Excel day-fraction, or a bare hour. Hours 1–6 without AM/PM are afternoon. */
export function parseClockToMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\./g, "");
  if (!s) return null;

  if (!s.includes(":") && !/[ap]m/.test(s)) {
    const num = Number(s);
    if (Number.isFinite(num)) {
      if (num > 0 && num < 1) return Math.round(num * 24 * 60) % (24 * 60);
      if (Number.isInteger(num) && num >= 0 && num <= 23) return bumpAfternoon(num) * 60;
    }
  }

  const match = s.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridian = match[4];
  if (minute > 59 || hour > 24) return null;
  if (meridian === "pm" && hour < 12) hour += 12;
  if (meridian === "am" && hour === 12) hour = 0;
  if (meridian === "am" && hour > 12) return null;
  if (!meridian) {
    if (hour === 24) return minute === 0 ? 0 : null;
    if (hour > 23) return null;
    hour = bumpAfternoon(hour);
  }
  if (hour > 23) return null;
  return hour * 60 + minute;
}

function bumpAfternoon(hour: number): number {
  if (hour >= 1 && hour <= 6) return hour + 12;
  return hour;
}

export function parseTimeRange(raw: string): { start: number; end: number } | null {
  const parts = raw
    .trim()
    .split(/\s*(?:-|–|—|\bto\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const start = parseClockToMinutes(parts[0]);
  const end = parseClockToMinutes(parts[1]);
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

export function formatMinutes12(minutes: number): string {
  const clamped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(clamped / 60);
  const minute = clamped % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function minutesToPgTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function pgTimeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

export function hhmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function areaLabel(slot: GroupScheduleDraft): string {
  const place = slot.location.trim();
  if (!place || rotationWeekFromLocation(place)) return slot.activity.trim();
  return place;
}

export function slotMatchesArea(slot: GroupScheduleDraft, area: string): boolean {
  const query = area.trim().toLowerCase();
  if (!query) return true;
  const fields = [slot.location, slot.activity, areaLabel(slot)];
  return fields.some((field) => field.trim().toLowerCase() === query);
}

export function scheduleAreaOptions(slots: GroupScheduleDraft[]): string[] {
  const names = new Set<string>();
  for (const slot of slots) {
    const place = slot.location.trim();
    if (place && !rotationWeekFromLocation(place)) names.add(place);
    if (slot.activity.trim()) names.add(slot.activity.trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Periods in effect at a clock time.
 * A row with appliesOn wins over the weekly template for that group.
 * End time is the start of the next period, so 9:45 belongs to the next block.
 */
function slotRotation(slot: GroupScheduleDraft): 1 | 2 | null {
  return slot.rotationWeek ?? rotationWeekFromLocation(slot.location);
}

export function slotsAtTime(
  slots: GroupScheduleSlot[],
  ymd: string,
  minutes: number,
  rotationWeek?: 1 | 2 | null,
): GroupScheduleSlot[] {
  const day = dayOfWeekFromYmd(ymd);
  const covering = slots.filter((slot) => {
    if (minutes < slot.startMinutes || minutes >= slot.endMinutes) return false;
    if (rotationWeek != null) {
      const week = slotRotation(slot);
      if (week != null && week !== rotationWeek) return false;
    }
    if (slot.appliesOn) return slot.appliesOn === ymd;
    return slot.dayOfWeek === day;
  });

  const groupsWithOverride = new Set(
    covering.filter((slot) => slot.appliesOn === ymd).map((slot) => scheduleGroupName(slot.groupName).toLowerCase()),
  );

  return covering
    .filter(
      (slot) =>
        slot.appliesOn === ymd || !groupsWithOverride.has(scheduleGroupName(slot.groupName).toLowerCase()),
    )
    .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.activity.localeCompare(b.activity));
}

export function weeklyScheduleTemplateCsv(): string {
  return [
    "Group,Day,Start,End,Activity,Location",
    "Dolphins,Monday,9:00 AM,9:45 AM,Swim,Pool",
    "Dolphins,Monday,9:45 AM,10:30 AM,Arts & Crafts,Lodge",
    "Sharks,Monday,9:00 AM,9:45 AM,Gaga,Field",
    "Sharks,Monday,9:45 AM,10:30 AM,Swim,Pool",
  ].join("\n");
}
