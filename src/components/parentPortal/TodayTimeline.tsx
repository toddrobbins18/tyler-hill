import { Bus, Clock, Sparkles, Waves } from "lucide-react";
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

  const toneClasses = {
    warning: "bg-[hsl(38_90%_93%)] text-[hsl(32_70%_38%)] ring-[hsl(38_85%_88%)]",
    accent: "bg-[hsl(var(--pp-brand-soft))] text-[hsl(var(--pp-brand))] ring-[hsl(var(--pp-brand-muted))]",
    neutral: "bg-[hsl(158_35%_92%)] text-[hsl(158_40%_32%)] ring-[hsl(158_30%_88%)]",
  };

  return (
    <section className="pp-card overflow-hidden p-0 md:p-0">
      <div className="border-b border-[hsl(var(--pp-border)/0.6)] bg-gradient-to-r from-[hsl(var(--pp-brand-subtle))] to-transparent px-5 py-5 md:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--pp-brand))]" />
          <p className="pp-label">Today at camp</p>
        </div>
        <h2 className="mt-1.5 text-xl font-bold tracking-tight md:text-2xl">
          {formatFriendlyDate(todayIso)}
        </h2>
      </div>

      <div className="px-5 py-5 md:px-6 md:py-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-brand-subtle)/0.5)] px-4 py-6 text-center">
            <p className="text-sm leading-relaxed pp-text-muted">
              No schedule changes or lessons on file for today. Your campers follow the regular camp day
              unless you submit a pickup change or absence.
            </p>
          </div>
        ) : (
          <ol className="space-y-5">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="relative flex gap-4">
                  {index < items.length - 1 ? (
                    <span className="absolute left-[1.2rem] top-11 h-[calc(100%+0.5rem)] w-0.5 bg-gradient-to-b from-[hsl(var(--pp-border))] to-transparent" />
                  ) : null}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneClasses[item.tone]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 pb-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">{item.title}</p>
                      <span className="rounded-full bg-[hsl(var(--pp-brand-subtle))] px-2.5 py-0.5 text-xs font-semibold pp-text-muted">
                        {item.timeLabel}
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="mt-1.5 text-sm leading-relaxed pp-text-muted">{item.detail}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
