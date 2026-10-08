import { useEffect, useMemo, useState } from "react";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { campTodayDate, campTodayString } from "@/lib/campSeasonDate";

/** Live clock + real camp-timezone “today” (sidebar season filters data, not the calendar year). */
export function useCampOperationalDate() {
  const { currentSeason } = useSeasonContext();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const operationalDate = useMemo(() => campTodayDate(now), [now]);

  const operationalDateString = useMemo(() => campTodayString(now), [now]);

  return {
    now,
    operationalDate,
    operationalDateString,
    currentSeason,
  };
}
