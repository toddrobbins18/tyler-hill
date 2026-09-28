import { CheckCircle2, ChevronRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  camperDisplayGroup,
  camperInitials,
  type Absence,
  type Camper,
  type PickupChange,
  type SwimLesson,
} from "@/lib/parentPortalConstants";

type CamperCardProps = {
  camper: Camper;
  todayIso: string;
  absences: Absence[];
  pickups: PickupChange[];
  swimLessons: SwimLesson[];
  onView?: () => void;
  className?: string;
};

function todayAbsenceForCamper(absences: Absence[], camperId: string, todayIso: string) {
  return absences.find(
    (a) => a.camper_id === camperId && a.absence_date === todayIso && a.status !== "cancelled",
  );
}

function todayPickupForCamper(pickups: PickupChange[], camperId: string, todayIso: string) {
  return pickups.find(
    (p) => p.camper_id === camperId && p.change_date === todayIso && p.status !== "cancelled",
  );
}

function todaySwimForCamper(lessons: SwimLesson[], camperId: string, todayIso: string) {
  return lessons.find(
    (l) => l.camper_id === camperId && l.scheduled_at.slice(0, 10) === todayIso,
  );
}

export function CamperCard({
  camper,
  todayIso,
  absences,
  pickups,
  swimLessons,
  onView,
  className,
}: CamperCardProps) {
  const group = camperDisplayGroup(camper);
  const absence = todayAbsenceForCamper(absences, camper.id, todayIso);
  const pickup = todayPickupForCamper(pickups, camper.id, todayIso);
  const swim = todaySwimForCamper(swimLessons, camper.id, todayIso);

  const statusLine = absence
    ? `Not attending today · ${absence.absence_type.replace(/_/g, " ")}`
    : camper.status === "inactive"
      ? "Not currently enrolled"
      : "Expected at camp today";

  return (
    <article
      className={cn(
        "pp-card group flex flex-col overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
        className,
      )}
    >
      <div className="p-5 pb-4">
        <div className="flex items-start gap-4">
          {camper.photo_url ? (
            <img
              src={camper.photo_url}
              alt=""
              className="h-[4.25rem] w-[4.25rem] shrink-0 rounded-[1.125rem] object-cover ring-2 ring-[hsl(var(--pp-brand-soft))] ring-offset-2"
            />
          ) : (
            <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-[1.125rem] bg-gradient-to-br from-[hsl(var(--pp-brand))] to-[hsl(var(--pp-brand-dark))] text-lg font-bold text-white shadow-md">
              {camperInitials(camper.name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold tracking-tight">{camper.name}</h3>
            {group ? <p className="mt-0.5 text-sm pp-text-muted">{group}</p> : null}
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                absence
                  ? "bg-[hsl(38_90%_94%)] text-[hsl(32_70%_38%)]"
                  : camper.status === "inactive"
                    ? "bg-[hsl(var(--pp-brand-subtle))] pp-text-muted"
                    : "bg-[hsl(158_35%_92%)] text-[hsl(158_40%_32%)]",
              )}
            >
              {!absence && camper.status !== "inactive" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : absence ? (
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              {statusLine}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-[hsl(var(--pp-border)/0.7)] bg-gradient-to-b from-[hsl(var(--pp-brand-subtle)/0.6)] to-transparent px-5 py-4">
        <div className="space-y-2.5 text-sm">
          {pickup ? (
            <div className="flex justify-between gap-3">
              <span className="pp-text-muted">Pickup change</span>
              <span className="text-right font-semibold">
                {pickup.pickup_time || "Time TBD"}
                {pickup.pickup_person_name ? ` · ${pickup.pickup_person_name}` : ""}
              </span>
            </div>
          ) : null}
          {swim ? (
            <div className="flex justify-between gap-3">
              <span className="pp-text-muted">Swim lesson</span>
              <span className="font-semibold">
                {new Date(swim.scheduled_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ) : null}
          {!pickup && !swim ? (
            <p className="pp-text-muted">No special schedule updates for today.</p>
          ) : null}
        </div>
      </div>

      {onView ? (
        <Button
          variant="ghost"
          className="h-12 w-full justify-between rounded-none border-t border-[hsl(var(--pp-border)/0.5)] px-5 font-semibold hover:bg-[hsl(var(--pp-brand-subtle))]"
          onClick={onView}
        >
          View camper
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Button>
      ) : null}
    </article>
  );
}
