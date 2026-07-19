import { format } from "date-fns";

export function sportsCalendarTodayYmd(date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function isUpcomingSportsCalendarDate(
  eventDate: string | null | undefined,
  todayYmd = sportsCalendarTodayYmd(),
): boolean {
  if (!eventDate) return false;
  const ymd = String(eventDate).trim().split("T")[0];
  return ymd >= todayYmd;
}
