function localDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseSeasonYear(season: string): number {
  const match = String(season).match(/(\d{4})/);
  if (match) return Number(match[1]);
  return new Date().getFullYear();
}

/** First day of the camp program for a season (June 26 of the season year). */
export function campProgramStartDate(season: string): string {
  const year = parseSeasonYear(season);
  return `${year}-06-26`;
}

/**
 * Default start date when CSV or manual entry omits one.
 * Before camp opens → program start; on/after camp opens → today.
 */
export function defaultMedicationStartDate(season: string, referenceDate: Date = new Date()): string {
  const campStart = campProgramStartDate(season);
  const today = localDateYmd(referenceDate);
  return today < campStart ? campStart : today;
}
