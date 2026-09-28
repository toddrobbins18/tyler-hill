import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CAMP_WEEKDAY_OPTIONS,
  type CampWeekday,
  swimLessonWeekOptions,
} from "@/lib/swimLessonSchedule";
import type { EnrollmentWeekCalendar } from "@/lib/enrollmentWeekCalendar";

type Props = {
  calendar: EnrollmentWeekCalendar;
  selectedWeeks: number[];
  onWeeksChange: (weeks: number[]) => void;
  selectedDays: CampWeekday[];
  onDaysChange: (days: CampWeekday[]) => void;
  previewCount: number;
};

export function SwimLessonRecurringFields({
  calendar,
  selectedWeeks,
  onWeeksChange,
  selectedDays,
  onDaysChange,
  previewCount,
}: Props) {
  const weekOptions = swimLessonWeekOptions(calendar);

  const toggleWeek = (weekNumber: number) => {
    onWeeksChange(
      selectedWeeks.includes(weekNumber)
        ? selectedWeeks.filter((w) => w !== weekNumber)
        : [...selectedWeeks, weekNumber].sort((a, b) => a - b),
    );
  };

  const toggleDay = (day: CampWeekday) => {
    onDaysChange(
      selectedDays.includes(day)
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort(),
    );
  };

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
      <div className="space-y-2">
        <Label>Weeks</Label>
        <div className="grid grid-cols-2 gap-2">
          {weekOptions.map((week) => (
            <Button
              key={week.weekNumber}
              type="button"
              variant={selectedWeeks.includes(week.weekNumber) ? "default" : "outline"}
              size="sm"
              className="h-auto flex-col items-start py-2 px-3"
              onClick={() => toggleWeek(week.weekNumber)}
            >
              <span className="font-medium">{week.label}</span>
              <span className="text-[10px] opacity-80 font-normal">{week.range}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Days</Label>
        <div className="flex flex-wrap gap-2">
          {CAMP_WEEKDAY_OPTIONS.map((day) => (
            <Button
              key={day.value}
              type="button"
              variant={selectedDays.includes(day.value) ? "default" : "outline"}
              size="sm"
              className={cn("min-w-[3rem]")}
              onClick={() => toggleDay(day.value)}
            >
              {day.short}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {previewCount > 0
          ? `${previewCount} lesson${previewCount === 1 ? "" : "s"} will be scheduled`
          : "Pick at least one week and one day"}
      </p>
    </div>
  );
}
