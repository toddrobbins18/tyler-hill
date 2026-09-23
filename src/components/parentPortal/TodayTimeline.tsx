import { Bus, Clock, Waves } from "lucide-react";
import {
  absenceTypeLabel,
  changeTypeLabel,
  formatFriendlyDate,
  type Absence,
  type PickupChange,
  type SwimLesson,
} from "@/lib/parentPortalConstants";
type TodayTimelineProps = {
  todayIso: string;
  pickups: PickupChange[];
  absences: Absence[];
  swimLessons: SwimLesson[];
  camperName: (id: string) => string;
};

type TimelineItem = {
  id: string;
  timeLabel: string;
  title: string;
  detail?: string;
  icon: typeof Clock;
  tone: "neutral" | "warning" | "accent";
};

export function TodayTimeline({
  todayIso,
  pickups,
  absences,
  swimLessons,
  camperName,
}: TodayTimelineProps) {
  const items: TimelineItem[] = [];

  for (const absence of absences.filter(
    (a) => a.absence_date === todayIso && a.status !== "cancelled",
  )) {
    items.push({
      id: `absence-${absence.id}`,
      timeLabel: absence.arrival_time || "All day",
      title: `${camperName(absence.camper_id)} · ${absenceTypeLabel(absence.absence_type)}`,
      detail: absence.reason ?? undefined,
      icon: Clock,
      tone: "warning",
    });
  }

  for (const pickup of pickups.filter(
    (p) => p.change_date === todayIso && p.status !== "cancelled",
  )) {
    items.push({
      id: `pickup-${pickup.id}`,
      timeLabel: pickup.pickup_time || "Scheduled",
      title: `${camperName(pickup.camper_id)} · ${changeTypeLabel(pickup.change_type)}`,
      detail: pickup.pickup_person_name
        ? `Pickup by ${pickup.pickup_person_name}`
        : pickup.notes ?? undefined,
      icon: Bus,
      tone: "accent",
    });
  }

  for (const lesson of swimLessons.filter((l) => l.scheduled_at.slice(0, 10) === todayIso)) {
    items.push({
      id: `swim-${lesson.id}`,
      timeLabel: new Date(lesson.scheduled_at).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
      title: `${camperName(lesson.camper_id)} · Swim lesson`,
      detail: [
        `${lesson.duration_minutes} min`,
        lesson.instructor ? `Instructor ${lesson.instructor}` : null,
        lesson.location,
      ]
        .filter(Boolean)
        .join(" · "),
      icon: Waves,
      tone: "neutral",
    });
  }

  items.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));

  return (
    <section className="rounded-2xl border border-[hsl(var(--pp-border))] bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] pp-text-subtle">
          Today at camp
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {formatFriendlyDate(todayIso)}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-[hsl(var(--pp-brand-subtle))] px-4 py-5 text-sm pp-text-muted">
          No schedule changes or lessons on file for today. Your campers follow the regular camp day unless
          you submit a pickup change or absence.
        </p>
      ) : (
        <ol className="space-y-4">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="relative flex gap-4 pl-1">
                {index < items.length - 1 ? (
                  <span className="absolute left-[1.15rem] top-10 h-[calc(100%+0.25rem)] w-px bg-[hsl(40_18%_88%)]" />
                ) : null}
                <div
                  className={
                    item.tone === "warning"
                      ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(38_90%_93%)] text-[hsl(32_70%_38%)]"
                      : item.tone === "accent"
                        ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(210_35%_93%)] text-[hsl(var(--pp-brand))]"
                        : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(158_35%_92%)] text-[hsl(158_40%_32%)]"
                  }
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{item.title}</p>
                    <span className="text-sm pp-text-muted">{item.timeLabel}</span>
                  </div>
                  {item.detail ? (
                    <p className="mt-1 text-sm pp-text-muted">{item.detail}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
