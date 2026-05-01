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

export type MedicationBedtimeOption = {
  id: string;
  /** Division label shown in dropdown */
  division: string;
  /** Stored in medication_logs.meal_time[0]; keeps "Bedtime" for sort/display */
  mealTimeLabel: string;
  /** HH:mm (24h) — missed-dose emails run after this camp-local time */
  scheduledTimeHHmm: string;
};

/** Bedtime row: one division → one scheduled time */
export const MEDICATION_BEDTIME_OPTIONS: MedicationBedtimeOption[] = [
  {
    id: "bedtime-21-00-freshman",
    division: "Freshman A & B",
    mealTimeLabel: "Bedtime · Freshman A & B",
    scheduledTimeHHmm: "21:00",
  },
  {
    id: "bedtime-21-15-cadets",
    division: "Cadets",
    mealTimeLabel: "Bedtime · Cadets",
    scheduledTimeHHmm: "21:15",
  },
  {
    id: "bedtime-21-30-sophomores",
    division: "Sophomores",
    mealTimeLabel: "Bedtime · Sophomores",
    scheduledTimeHHmm: "21:30",
  },
  {
    id: "bedtime-21-45-juniors",
    division: "Juniors",
    mealTimeLabel: "Bedtime · Juniors",
    scheduledTimeHHmm: "21:45",
  },
  {
    id: "bedtime-22-00-seniors",
    division: "Seniors",
    mealTimeLabel: "Bedtime · Seniors",
    scheduledTimeHHmm: "22:00",
  },
  {
    id: "bedtime-22-15-supers",
    division: "Supers",
    mealTimeLabel: "Bedtime · Supers",
    scheduledTimeHHmm: "22:15",
  },
  {
    id: "bedtime-22-30-teens",
    division: "Teens",
    mealTimeLabel: "Bedtime · Teens",
    scheduledTimeHHmm: "22:30",
  },
  {
    id: "bedtime-22-45-cits",
    division: "CITS",
    mealTimeLabel: "Bedtime · CITS",
    scheduledTimeHHmm: "22:45",
  },
];

export function findBedtimeOptionById(id: string | null | undefined): MedicationBedtimeOption | undefined {
  if (!id) return undefined;
  return MEDICATION_BEDTIME_OPTIONS.find((o) => o.id === id);
}

/** Match stored meal_time[0] to a bedtime option (current or legacy wording). */
export function findBedtimeOptionFromStoredMealLabel(label: string | null | undefined): MedicationBedtimeOption | undefined {
  if (!label || typeof label !== "string") return undefined;
  const direct = MEDICATION_BEDTIME_OPTIONS.find((o) => o.mealTimeLabel === label);
  if (direct) return direct;
  const byDivision = MEDICATION_BEDTIME_OPTIONS.find((o) => label === o.division || label.endsWith(o.division));
  if (byDivision) return byDivision;
  return MEDICATION_BEDTIME_OPTIONS.find(
    (o) =>
      label.includes(o.division) ||
      label.replace(/\s/g, "").includes(o.division.replace(/\s/g, ""))
  );
}
