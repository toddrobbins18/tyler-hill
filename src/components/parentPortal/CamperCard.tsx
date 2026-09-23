import { CheckCircle2, ChevronRight } from "lucide-react";
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
        "group flex flex-col rounded-2xl border border-[hsl(var(--pp-border))] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {camper.photo_url ? (
          <img
            src={camper.photo_url}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--pp-brand-soft))] to-[hsl(var(--pp-brand-muted))] text-lg font-semibold text-[hsl(var(--pp-brand-dark))]">
            {camperInitials(camper.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold tracking-tight">{camper.name}</h3>
          {group ? (
            <p className="mt-0.5 text-sm pp-text-muted">{group}</p>
          ) : null}
          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1.5 text-sm",
              absence ? "text-[hsl(32_70%_38%)]" : "text-[hsl(158_40%_32%)]",
            )}
          >
            {!absence && camper.status !== "inactive" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : null}
            {statusLine}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-xl bg-[hsl(var(--pp-brand-subtle))] p-3 text-sm">
        {pickup ? (
          <div className="flex justify-between gap-2">
            <span className="pp-text-muted">Pickup change</span>
            <span className="text-right font-medium">
              {pickup.pickup_time || "Time TBD"}
              {pickup.pickup_person_name ? ` · ${pickup.pickup_person_name}` : ""}
            </span>
          </div>
        ) : null}
        {swim ? (
          <div className="flex justify-between gap-2">
            <span className="pp-text-muted">Swim lesson</span>
            <span className="font-medium">
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

      {onView ? (
        <Button
          variant="ghost"
          className="mt-4 w-full justify-between rounded-xl hover:bg-[hsl(var(--pp-brand-soft))]"
          onClick={onView}
        >
          View camper
          <ChevronRight className="h-4 w-4" />
        </Button>
      ) : null}
    </article>
  );
}
