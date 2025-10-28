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
    return localStorage.getItem('currentSeason') || '2026';
  });
  
  const [availableSeasons, setAvailableSeasons] = useState<string[]>(['2026', '2025']);

  useEffect(() => {
    localStorage.setItem('currentSeason', currentSeason);
  }, [currentSeason]);

  // One-time migration: Update 2025 to 2026 in localStorage
  useEffect(() => {
    const storedSeason = localStorage.getItem('currentSeason');
    if (storedSeason === '2025') {
      setCurrentSeason('2026');
    }
  }, []);

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
