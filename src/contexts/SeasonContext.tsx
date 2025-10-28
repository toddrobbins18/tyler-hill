import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SeasonContextType {
  currentSeason: string;
  setCurrentSeason: (season: string) => void;
  availableSeasons: string[];
  setAvailableSeasons: (seasons: string[]) => void;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [currentSeason, setCurrentSeason] = useState<string>(() => {
    return localStorage.getItem('currentSeason') || '2025';
  });
  
  const [availableSeasons, setAvailableSeasons] = useState<string[]>(['2025', '2026']);

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
