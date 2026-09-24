import { useEffect, useMemo, useState } from "react";
import {
  formatDateAsOdCampDayYmd,
  odCampDayDateInSeason,
} from "@/lib/odCampDay";

/** Live clock + OD sheet "today" (camp day rolls at 1:00 AM Eastern). */
export function useOdCampDay(season: string) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = useMemo(() => odCampDayDateInSeason(season, now), [season, now]);
  const todayYmd = useMemo(() => formatDateAsOdCampDayYmd(today), [today]);

  return { now, today, todayYmd };
}
