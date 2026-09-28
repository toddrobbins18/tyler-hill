import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SWIM_LESSON_TIME_OPTIONS } from "@/lib/swimLessonSchedule";

type Props = {
  value: string;
  onChange: (time: string) => void;
};

export function SwimLessonTimeSelect({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Time</Label>
      <div className="flex gap-2">
        {SWIM_LESSON_TIME_OPTIONS.map((slot) => (
          <Button
            key={slot.value}
            type="button"
            variant={value === slot.value ? "default" : "outline"}
            className={cn("flex-1")}
            onClick={() => onChange(slot.value)}
          >
            {slot.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
