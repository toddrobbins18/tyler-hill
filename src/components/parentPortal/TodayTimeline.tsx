import { Bus, Clock, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
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
  tone: "amber" | "blue" | "emerald";
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
      tone: "amber",
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
      tone: "blue",
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
      tone: "emerald",
    });
  }

  items.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));

  const toneStyles = {
    amber: "bg-amber-50 text-amber-600 ring-amber-100",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  };

  return (
    <section className="pp-card overflow-hidden rounded-2xl">
      <div className="border-b border-slate-100 px-5 py-4 md:px-6 md:py-5">
        <h2 className="pp-dashboard-section-title">Today&apos;s schedule</h2>
        <p className="mt-0.5 text-sm text-slate-500">{formatFriendlyDate(todayIso)}</p>
      </div>

      <div className="px-5 py-5 md:px-6 md:py-6">
        {items.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-4">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <p className="text-sm leading-relaxed text-slate-600">
              All clear for today — your campers follow the regular camp schedule.
            </p>
          </div>
        ) : (
          <ol className="space-y-4">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.id}
                  className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                      toneStyles[item.tone],
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                        {item.timeLabel}
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.detail}</p>
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
