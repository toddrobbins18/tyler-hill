import { useEffect, useMemo, useState } from "react";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { campDateInSeason, campDateStringInSeason } from "@/lib/campSeasonDate";

/** Live clock + camp "today" aligned to the sidebar season year. */
export function useCampOperationalDate() {
  const { currentSeason } = useSeasonContext();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const operationalDate = useMemo(
    () => campDateInSeason(currentSeason, now),
    [currentSeason, now],
  );

  const operationalDateString = useMemo(
    () => campDateStringInSeason(currentSeason, now),
    [currentSeason, now],
  );

  return {
    now,
    operationalDate,
    operationalDateString,
    currentSeason,
  };
}
