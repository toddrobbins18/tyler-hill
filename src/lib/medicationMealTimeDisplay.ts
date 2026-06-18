import {
  findBedtimeOptionFromStoredMealLabel,
  resolveBedtimeOptionFromDivisionName,
  STANDARD_MEAL_LABEL_ORDER,
} from "./medicationBedtimeOptions";

/** Tailwind classes for standard meal-time badges. */
export const MEAL_TIME_BADGE_CLASSES: Record<string, string> = {
  "Before Breakfast": "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-100",
  "After Breakfast": "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-100",
  "Before Lunch": "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-100",
  "After Lunch": "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-100",
  "Before Dinner": "bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-950 dark:text-violet-100",
  "After Dinner": "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-100",
  Bedtime: "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100",
};

const BEDTIME_VARIANT_CLASSES = [
  "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100",
  "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 dark:bg-fuchsia-950 dark:text-fuchsia-100",
  "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950 dark:text-teal-100",
  "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-100",
];

function hashLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h + label.charCodeAt(i) * (i + 1)) % 997;
  return h;
}

/** Resolve stored meal_time into display labels (one per scheduled slot). */
export function parseMedicationMealTimeLabels(
  mealTime: string[] | string | null | undefined,
  divisionName?: string | null,
): string[] {
  if (mealTime == null) return [];

  const rawList = Array.isArray(mealTime) ? mealTime : [mealTime];
  const labels: string[] = [];

  for (const raw of rawList) {
    const first = String(raw ?? "").trim();
    if (!first) continue;

    if (first === "Bedtime") {
      const resolved = resolveBedtimeOptionFromDivisionName(divisionName);
      labels.push(resolved?.mealTimeLabel ?? "Bedtime");
      continue;
    }

    const bedtimeMatch = findBedtimeOptionFromStoredMealLabel(first);
    if (bedtimeMatch) {
      labels.push(bedtimeMatch.mealTimeLabel);
      continue;
    }

    labels.push(first);
  }

  return labels;
}

function isAsNeededMealLabel(label: string): boolean {
  const upper = label.trim().toUpperCase();
  return !upper || upper.includes("AS NEEDED") || upper === "PRN";
}

/** Non-recurring meds without a scheduled meal slot — profile only, not daily log. */
export function isAsNeededMedication(med: {
  is_recurring?: boolean | null;
  meal_time?: string[] | string | null;
  frequency?: string | null;
}): boolean {
  if (med.is_recurring) return false;

  const freq = String(med.frequency ?? "").trim().toUpperCase();
  if (freq.includes("AS NEEDED") || freq === "PRN") return true;

  const labels = parseMedicationMealTimeLabels(med.meal_time);
  const scheduledLabels = labels.filter((label) => !isAsNeededMealLabel(label));
  return scheduledLabels.length === 0;
}

export function medicationHasMealTime(
  mealTime: string[] | string | null | undefined,
  divisionName?: string | null,
): boolean {
  const labels = parseMedicationMealTimeLabels(mealTime, divisionName);
  return labels.some((label) => !isAsNeededMealLabel(label));
}

export function getMealTimeBadgeClass(label: string): string {
  for (const standard of STANDARD_MEAL_LABEL_ORDER) {
    if (label === standard || label.includes(standard)) {
      return MEAL_TIME_BADGE_CLASSES[standard];
    }
  }
  if (label.toLowerCase().includes("bedtime") || findBedtimeOptionFromStoredMealLabel(label)) {
    return BEDTIME_VARIANT_CLASSES[hashLabel(label) % BEDTIME_VARIANT_CLASSES.length];
  }
  return BEDTIME_VARIANT_CLASSES[hashLabel(label) % BEDTIME_VARIANT_CLASSES.length];
}

/** Filter options for meal-time dropdowns. */
export const MEDICATION_MEAL_FILTER_OPTIONS = [
  { value: "all", label: "All meal times" },
  ...STANDARD_MEAL_LABEL_ORDER.map((meal) => ({ value: meal, label: meal })),
  { value: "Bedtime", label: "Bedtime" },
] as const;

export function medicationMatchesMealFilter(
  mealTime: string[] | string | null | undefined,
  divisionName: string | null | undefined,
  filter: string,
): boolean {
  if (filter === "all") return true;
  const labels = parseMedicationMealTimeLabels(mealTime, divisionName);
  if (filter === "Bedtime") {
    return labels.some(
      (l) =>
        l === "Bedtime" ||
        l.toLowerCase().includes("bedtime") ||
        !!findBedtimeOptionFromStoredMealLabel(l),
    );
  }
  return labels.some((l) => l === filter || l.includes(filter));
}

type MedicationListVisibilityMed = {
  administered?: boolean;
  is_recurring?: boolean | null;
  frequency?: string | null;
  meal_time?: string[] | string | null;
  medication_name?: string | null;
};

/** Hide given / no-meal-time meds unless searching; as-needed meds never appear here. */
export function medicationMatchesListVisibility(
  med: MedicationListVisibilityMed,
  options: {
    searchQuery: string;
    mealFilter: string;
    divisionName?: string | null;
    childName?: string | null;
  },
): boolean {
  if (isAsNeededMedication(med)) return false;

  const searchLower = options.searchQuery.trim().toLowerCase();
  const isSearching = searchLower.length > 0;
  const childName = (options.childName ?? "").toLowerCase();
  const medName = (med.medication_name ?? "").toLowerCase();
  const matchesSearch =
    isSearching && (childName.includes(searchLower) || medName.includes(searchLower));

  if (med.administered) return matchesSearch;

  const hasMeal = medicationHasMealTime(med.meal_time, options.divisionName);
  if (!hasMeal) return matchesSearch;

  return medicationMatchesMealFilter(med.meal_time, options.divisionName, options.mealFilter);
}
