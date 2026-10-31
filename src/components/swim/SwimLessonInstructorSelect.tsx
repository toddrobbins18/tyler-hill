import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchSwimLessonInstructorOptions } from "@/lib/swimLessonInstructors";

type Props = {
  companyId: string | undefined;
  season: string;
  value: string;
  onChange: (name: string) => void;
};

export function SwimLessonInstructorSelect({ companyId, season, value, onChange }: Props) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!companyId) {
      setOptions([]);
      return;
    }
    void fetchSwimLessonInstructorOptions(supabase, companyId, season).then(setOptions);
  }, [companyId, season]);

  return (
    <div className="space-y-2">
      <Label>Instructor (lifeguard)</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select lifeguard" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none__" disabled>
              No lifeguards on staff roster for this season
            </SelectItem>
          ) : (
            options.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Only staff with Lifeguard role, Waterfront department, or Waterfront specialty appear here.
      </p>
    </div>
  );
}
