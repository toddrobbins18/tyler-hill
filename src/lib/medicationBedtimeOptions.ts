/** Ordered labels for standard meal slots (checkbox list / sorting). */
export const STANDARD_MEAL_LABEL_ORDER = [
  "Before Breakfast",
  "After Breakfast",
  "Before Lunch",
  "After Lunch",
  "Before Dinner",
  "After Dinner",
] as const;

/** Maps standard meal slots to HH:mm used for medication_logs.scheduled_time */
export const STANDARD_MEAL_SCHEDULE_HHMM: Record<string, string> = {
  "Before Breakfast": "08:00",
  "After Breakfast": "09:00",
  "Before Lunch": "12:00",
  "After Lunch": "13:00",
  "Before Dinner": "18:00",
  "After Dinner": "19:00",
};

/** US Eastern wall clock for missed-med eligibility (EST/EDT via IANA). */
export const MEDICATION_ALERT_TIMEZONE = "America/New_York";

export type MedicationBedtimeOption = {
  id: string;
  /** Roster / divisions.name keyword bucket */
  division: string;
  /** Stored on medication_logs.meal_time[0] */
  mealTimeLabel: string;
  /** HH:mm (24h) — compare after this US Eastern local time */
  scheduledTimeHHmm: string;
};

/**
 * Bedtime schedule by division bucket (Tyler Hill–style).
 * Times are interpreted as US Eastern in check-medication-alerts.
 */
export const MEDICATION_BEDTIME_OPTIONS: MedicationBedtimeOption[] = [
  {
    id: "bedtime-21-00-freshman",
    division: "Freshman A & B",
    mealTimeLabel: "For Freshman A & B: 9:00PM",
    scheduledTimeHHmm: "21:00",
  },
  {
    id: "bedtime-21-15-cadets",
    division: "Cadets",
    mealTimeLabel: "Cadets 9:15PM",
    scheduledTimeHHmm: "21:15",
  },
  {
    id: "bedtime-21-30-sophomores",
    division: "Sophomores",
    mealTimeLabel: "Sophomores 9:30PM",
    scheduledTimeHHmm: "21:30",
  },
  {
    id: "bedtime-21-45-juniors",
    division: "Juniors",
    mealTimeLabel: "Juniors 9:45PM",
    scheduledTimeHHmm: "21:45",
  },
  {
    id: "bedtime-22-00-seniors",
    division: "Seniors",
    mealTimeLabel: "Seniors 10PM",
    scheduledTimeHHmm: "22:00",
  },
  {
    id: "bedtime-22-15-supers",
    division: "Supers",
    mealTimeLabel: "Supers 10:15PM",
    scheduledTimeHHmm: "22:15",
  },
  {
    id: "bedtime-22-30-teens",
    division: "Teens",
    mealTimeLabel: "Teens 10:30 PM",
    scheduledTimeHHmm: "22:30",
  },
  {
    id: "bedtime-22-45-cits",
    division: "CITS",
    mealTimeLabel: "CITS 10:45PM",
    scheduledTimeHHmm: "22:45",
  },
];

export function findBedtimeOptionById(id: string | null | undefined): MedicationBedtimeOption | undefined {
  if (!id) return undefined;
  return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === id);
}

/** Match roster division.name (e.g. "Cadet Boys") → bedtime row. */
export function resolveBedtimeOptionFromDivisionName(raw: string | null | undefined): MedicationBedtimeOption | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return undefined;

  const normDiv = (d: string) => d.toLowerCase().replace(/\s+/g, " ").trim();

  for (const opt of MEDICATION_BEDTIME_OPTIONS) {
    const d = normDiv(opt.division);
    if (s === d || s.includes(d) || d.includes(s)) {
      return opt;
    }
  }

  const has = (re: RegExp) => re.test(s);

  if (has(/\bc\.?\s*i\.?\s*t\.?\b/) || /\bcits\b/.test(s)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-22-45-cits");
  }
  if (has(/freshman|freshmen|frosh/)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-21-00-freshman");
  }
  if (has(/cadet/)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-21-15-cadets");
  }
  if (has(/sophomore/)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-21-30-sophomores");
  }
  if (has(/junior/)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-21-45-juniors");
  }
  if (has(/super/)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-22-15-supers");
  }
  if (has(/senior/)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-22-00-seniors");
  }
  if (has(/teen/)) {
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === "bedtime-22-30-teens");
  }

  return undefined;
}

/** Match stored meal_time[0] to a bedtime option (current or legacy). */
export function findBedtimeOptionFromStoredMealLabel(label: string | null | undefined): MedicationBedtimeOption | undefined {
  if (!label || typeof label !== "string") return undefined;
  const direct = MEDICATION_BEDTIME_OPTIONS.find((o) => o.mealTimeLabel === label);
  if (direct) return direct;

  const lowered = label.toLowerCase();
  for (const opt of MEDICATION_BEDTIME_OPTIONS) {
    if (lowered.includes(opt.division.toLowerCase())) return opt;
    if (lowered.includes(opt.mealTimeLabel.toLowerCase())) return opt;
  }

  if (lowered.includes("bedtime")) {
    return resolveBedtimeOptionFromDivisionName(label.replace(/^.*?bedtime[^·]*·?\s*/i, "").trim()) ?? undefined;
  }

  const legacyTimeMatch = label.match(/(\d{1,2}):(\d{2})/);
  if (legacyTimeMatch) {
    const hh = legacyTimeMatch[1].padStart(2, "0");
    const mm = legacyTimeMatch[2].padStart(2, "0");
    return MEDICATION_BEDTIME_OPTIONS.find((o) => o.scheduledTimeHHmm === `${hh}:${mm}`);
  }

  return undefined;
}

/**
 * Bedtime rows store `meal_time = ['Bedtime']` (DB check). Use division name to show
 * labels like “Cadets 9:15PM” in dashboards.
 */
export function formatMedicationMealTimeForDisplay(
  mealTime: string[] | string | null | undefined,
  divisionName?: string | null,
): string {
  if (!mealTime) return "";
  const arr = Array.isArray(mealTime) ? mealTime : [mealTime];
  const first = arr[0];
  if (!first) return "";

  if (first === "Bedtime") {
    const resolved = resolveBedtimeOptionFromDivisionName(divisionName);
    return resolved?.mealTimeLabel ?? "Bedtime";
  }

  const bedtimeMatch = findBedtimeOptionFromStoredMealLabel(first);
  if (bedtimeMatch) return bedtimeMatch.mealTimeLabel;

  if (arr.length === 1) return first;
  return arr.filter(Boolean).join(", ");
}
