import { Badge } from "@/components/ui/badge";
import {
  getMealTimeBadgeClass,
  parseMedicationMealTimeLabels,
} from "@/lib/medicationMealTimeDisplay";

type Props = {
  mealTime: string[] | string | null | undefined;
  divisionName?: string | null;
};

export function MedicationMealTimeBadges({ mealTime, divisionName }: Props) {
  const labels = parseMedicationMealTimeLabels(mealTime, divisionName);

  if (labels.length === 0) {
    return (
      <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-dashed">
        No meal time
      </Badge>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={`text-xs font-medium border ${getMealTimeBadgeClass(label)}`}
        >
          {label}
        </Badge>
      ))}
    </span>
  );
}
