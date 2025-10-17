import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from 'lucide-react';

export default function SeasonSelector() {
  const { currentSeason, setCurrentSeason, availableSeasons, setAvailableSeasons } = useSeasonContext();

  useEffect(() => {
    fetchAvailableSeasons();
  }, []);

  const fetchAvailableSeasons = async () => {
    // Query distinct seasons from children table (or any other table)
    const { data } = await supabase
      .from('children')
      .select('season')
      .order('season', { ascending: false });

    if (data) {
      const uniqueSeasons = [...new Set(data.map(d => d.season).filter(Boolean))];
      if (uniqueSeasons.length > 0) {
        setAvailableSeasons(uniqueSeasons as string[]);
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={currentSeason} onValueChange={setCurrentSeason}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Select season" />
        </SelectTrigger>
        <SelectContent>
          {availableSeasons.map((season) => (
            <SelectItem key={season} value={season}>
              {season}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
