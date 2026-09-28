import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchSwimLessonInstructorOptions,
  saveInstructorName,
} from "@/lib/swimLessonInstructors";

type Props = {
  companyId: string | undefined;
  season: string;
  value: string;
  onChange: (name: string) => void;
};

export function SwimLessonInstructorSelect({ companyId, season, value, onChange }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!companyId) {
      setOptions([]);
      return;
    }
    void fetchSwimLessonInstructorOptions(supabase, companyId, season).then(setOptions);
  }, [companyId, season]);

  const addInstructor = () => {
    if (!companyId) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    const next = saveInstructorName(companyId, trimmed);
    setOptions(next);
    onChange(trimmed);
    setNewName("");
  };

  return (
    <div className="space-y-2">
      <Label>Instructor</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select instructor" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none__" disabled>
              Add an instructor below
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
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add instructor name"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addInstructor();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={addInstructor} title="Add instructor">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
