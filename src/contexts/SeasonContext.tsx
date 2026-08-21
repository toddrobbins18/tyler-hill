import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AVAILABLE_SEASONS,
  DEFAULT_SEASON,
  isCampSeason,
  SEASON_BOOTSTRAP_VERSION,
} from '@/lib/seasonConstants';

interface SeasonContextType {
  currentSeason: string;
  setCurrentSeason: (season: string) => void;
  availableSeasons: string[];
  setAvailableSeasons: (seasons: string[]) => void;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

const SEASON_BOOTSTRAP_KEY = 'seasonBootstrapVersion';

function resolveInitialSeason(): string {
  if (typeof window === 'undefined') return DEFAULT_SEASON;

  const bootstrapDone = localStorage.getItem(SEASON_BOOTSTRAP_KEY);
  if (bootstrapDone !== SEASON_BOOTSTRAP_VERSION) {
    localStorage.setItem('currentSeason', DEFAULT_SEASON);
    localStorage.setItem(SEASON_BOOTSTRAP_KEY, SEASON_BOOTSTRAP_VERSION);
    return DEFAULT_SEASON;
  }

  const stored = localStorage.getItem('currentSeason');
  if (!stored || !isCampSeason(stored)) {
    localStorage.setItem('currentSeason', DEFAULT_SEASON);
    return DEFAULT_SEASON;
  }

  return stored;
}

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [currentSeason, setCurrentSeason] = useState<string>(resolveInitialSeason);
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([...AVAILABLE_SEASONS]);

  useEffect(() => {
    localStorage.setItem('currentSeason', currentSeason);
  }, [currentSeason]);

  return (
    <SeasonContext.Provider
      value={{
        currentSeason,
        setCurrentSeason,
        availableSeasons,
        setAvailableSeasons,
      }}
    >
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeasonContext() {
  const context = useContext(SeasonContext);
  if (context === undefined) {
    throw new Error('useSeasonContext must be used within a SeasonProvider');
  }
  return context;
}

// Alias for compatibility
export function useSeason() {
  const context = useSeasonContext();
  return {
    selectedSeason: context.currentSeason,
    setSelectedSeason: context.setCurrentSeason,
  };
}
