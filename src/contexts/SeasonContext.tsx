import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SeasonContextType {
  currentSeason: string;
  setCurrentSeason: (season: string) => void;
  availableSeasons: string[];
  setAvailableSeasons: (seasons: string[]) => void;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export function SeasonProvider({ children }: { children: ReactNode }) {
  // Keep this list small + explicit so we can safely self-heal bad localStorage values
  const AVAILABLE_SEASONS = ['2025', '2026'] as const;
  const DEFAULT_SEASON: string = AVAILABLE_SEASONS[AVAILABLE_SEASONS.length - 1];

  const [currentSeason, setCurrentSeason] = useState<string>(() => {
    const stored = localStorage.getItem('currentSeason');

    // If preview/live domains have different localStorage (they do), stored values can drift.
    // Self-heal anything missing or not in our supported list.
    if (!stored || !AVAILABLE_SEASONS.includes(stored as any)) {
      localStorage.setItem('currentSeason', DEFAULT_SEASON);
      return DEFAULT_SEASON;
    }

    return stored;
  });
  
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
