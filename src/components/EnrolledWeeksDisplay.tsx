import { cn } from "@/lib/utils";
import {
  DAY_CAMP_ENROLLMENT_WEEKS,
  formatEnrolledWeeksLabel,
} from "@/lib/enrolledWeeks";

type Props = {
  weeks: number[];
  sessionLabel?: string | null;
  className?: string;
};

export default function EnrolledWeeksDisplay({ weeks, sessionLabel, className }: Props) {
  const enrolled = new Set(weeks);
  const label = formatEnrolledWeeksLabel(weeks);

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <p className="font-medium">{label}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: DAY_CAMP_ENROLLMENT_WEEKS }, (_, i) => {
          const week = i + 1;
          const active = enrolled.has(week);
          return (
            <span
              key={week}
              className={cn(
                "inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full border px-2 text-xs font-semibold",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted bg-muted/40 text-muted-foreground",
              )}
            >
              {week}
            </span>
          );
        })}
      </div>
      {!label && sessionLabel ? (
        <p className="text-xs text-muted-foreground">CampMinder: {sessionLabel}</p>
      ) : null}
    </div>
  );
}
