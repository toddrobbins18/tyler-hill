import { CAMP_TIMEZONE } from "@/lib/parentPortalCutoff";

export { CAMP_TIMEZONE };

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** DST-aware offset for a camp calendar day, e.g. "-04:00". */
function getCampUtcOffsetIso(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(probe)
    .find((part) => part.type === "timeZoneName")?.value;

  const match = tzName?.match(/(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return "-04:00";
  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

/** YYYY-MM-DD + HH:mm entered as camp local time → UTC ISO for Supabase. */
export function campDateTimeToIso(ymd: string, time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  const offset = getCampUtcOffsetIso(ymd);
  return new Date(`${ymd}T${normalized}${offset}`).toISOString();
}

export function campYmdToUtcStartIso(ymd: string): string {
  const offset = getCampUtcOffsetIso(ymd);
  return new Date(`${ymd}T00:00:00.000${offset}`).toISOString();
}

export function campYmdToUtcEndIso(ymd: string): string {
  const offset = getCampUtcOffsetIso(ymd);
  return new Date(`${ymd}T23:59:59.999${offset}`).toISOString();
}

export function campDateFromTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAMP_TIMEZONE }).format(new Date(iso));
}

export function campLocalHourFromTimestamp(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CAMP_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(new Date(iso)),
  );
}

export type CampRunPeriod = "am" | "pm";

export function swimLessonBusRun(scheduledAt: string): CampRunPeriod {
  return campLocalHourFromTimestamp(scheduledAt) < 12 ? "am" : "pm";
}

export function formatCampDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatCampTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatCampDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
