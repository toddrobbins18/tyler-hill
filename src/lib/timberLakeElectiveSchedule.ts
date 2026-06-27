/** Timber Lake Camp elective sign-up days (no Wednesday — camp schedule). */
export const TIMBER_LAKE_ELECTIVE_DAYS = [
  "Monday",
  "Tuesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const TIMBER_LAKE_ELECTIVE_PERIODS = [
  { id: "period-1", label: "Period 1", time: "10:00 – 11:00 AM" },
  { id: "period-2", label: "Period 2", time: "11:15 AM – 12:15 PM" },
  { id: "period-3", label: "Period 3", time: "1:45 – 2:45 PM" },
  { id: "period-4", label: "Period 4", time: "3:15 – 4:15 PM" },
  { id: "period-5", label: "Period 5", time: "4:30 – 5:30 PM" },
] as const;

export type TimberLakeElectivePeriodId = (typeof TIMBER_LAKE_ELECTIVE_PERIODS)[number]["id"];

export function parseElectivePeriodNumber(periodId: string): number | null {
  const match = /^period-(\d+)$/.exec(periodId);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/** Water Ski is only offered in periods 3, 4, and 5. */
export function isWaterSkiElectivePeriod(periodId: string): boolean {
  const n = parseElectivePeriodNumber(periodId);
  return n != null && n >= 3 && n <= 5;
}

export function filterElectivesForPeriod<T extends { name: string }>(
  electives: T[],
  periodId: string,
): T[] {
  if (isWaterSkiElectivePeriod(periodId)) {
    return electives;
  }
  return electives.filter((e) => !e.name.toLowerCase().includes("water ski"));
}
