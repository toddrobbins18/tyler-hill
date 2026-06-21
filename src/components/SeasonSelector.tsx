import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { Calendar } from 'lucide-react';

export default function SeasonSelector() {
  const { currentSeason, setCurrentSeason, availableSeasons } = useSeasonContext();

  return (
    <div className="flex items-center gap-2 w-full">
      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />
      <Select value={currentSeason} onValueChange={setCurrentSeason}>
        <SelectTrigger className="w-full text-foreground">
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
