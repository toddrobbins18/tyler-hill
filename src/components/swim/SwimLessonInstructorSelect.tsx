import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchSwimLessonInstructorOptions, mergeSwimInstructorNames, saveInstructorName } from "@/lib/swimLessonInstructors";

type Props = {
  companyId: string | undefined;
  season: string;
  value: string;
  onChange: (name: string) => void;
};

export function SwimLessonInstructorSelect({ companyId, season, value, onChange }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const reload = () => {
    if (!companyId) {
      setOptions([]);
      return;
    }
    void fetchSwimLessonInstructorOptions(supabase, companyId, season).then(setOptions);
  };

  useEffect(() => {
    reload();
  }, [companyId, season]);

  const addInstructor = () => {
    const name = draft.trim();
    if (!companyId || !name) return;
    saveInstructorName(companyId, name);
    setOptions((prev) => mergeSwimInstructorNames(prev, [name], []));
    setDraft("");
    onChange(name);
    reload();
  };

  return (
    <div className="space-y-2">
      <Label>Instructor</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select lifeguard" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none__" disabled>
              No instructors yet — add a name below
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
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add instructor"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addInstructor();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addInstructor} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Lifeguards are listed automatically. Add anyone else who teaches. Each person has 3:45 and 4:15 open until a lesson is booked.
      </p>
    </div>
  );
}
