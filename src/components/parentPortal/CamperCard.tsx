import { ChevronRight } from "lucide-react";
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
  cardClassName?: string;
  /** Larger layout for the home dashboard */
  variant?: "default" | "dashboard";
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
  cardClassName,
  variant = "default",
}: CamperCardProps) {
  const isDashboard = variant === "dashboard";
  const group = camperDisplayGroup(camper);
  const absence = todayAbsenceForCamper(absences, camper.id, todayIso);
  const pickup = todayPickupForCamper(pickups, camper.id, todayIso);
  const swim = todaySwimForCamper(swimLessons, camper.id, todayIso);

  const statusLine = absence
    ? `Not at camp · ${absence.absence_type.replace(/_/g, " ")}`
    : camper.status === "inactive"
      ? "Not enrolled"
      : "At camp today";

  const statusPillClass = absence
    ? "pp-status-pill pp-status-pill-warning"
    : camper.status === "inactive"
      ? "pp-status-pill pp-status-pill-neutral"
      : "pp-status-pill pp-status-pill-success";

  const statusDotClass = absence
    ? "bg-amber-500"
    : camper.status === "inactive"
      ? "bg-slate-400"
      : "bg-emerald-500";

  const avatarSize = isDashboard ? "h-[4.5rem] w-[4.5rem] text-xl" : "h-14 w-14 text-sm";
  const padding = isDashboard ? "p-6" : "p-5";
  const photoUrl = camper.photo_url?.trim() || null;

  const body = (
    <>
      <div className={cn("flex items-start gap-4", isDashboard && "gap-5")}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className={cn(
              "shrink-0 rounded-2xl object-cover ring-2 ring-slate-100",
              avatarSize,
            )}
          />
        ) : (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--pp-brand-subtle))] font-bold text-[hsl(var(--pp-brand-dark))] ring-2 ring-[hsl(var(--pp-brand)/0.12)]",
              avatarSize,
            )}
          >
            {camperInitials(camper.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "truncate font-bold tracking-tight text-slate-900",
              isDashboard ? "text-lg" : "text-base font-semibold",
            )}
          >
            {camper.name}
          </h3>
          {group ? (
            <p className="mt-1 text-sm font-medium text-slate-500">{group}</p>
          ) : null}
          <div className={cn("mt-3", isDashboard && "mt-4")}>
            <span className={statusPillClass}>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass)} />
              {statusLine}
            </span>
          </div>
        </div>
      </div>

      {(pickup || swim) && (
        <dl
          className={cn(
            "mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm",
            isDashboard && "mt-6",
          )}
        >
          {pickup ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Pickup change</dt>
              <dd className="text-right font-semibold text-slate-800">
                {pickup.pickup_time || "Time TBD"}
                {pickup.pickup_person_name ? ` · ${pickup.pickup_person_name}` : ""}
              </dd>
            </div>
          ) : null}
          {swim ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Swim lesson</dt>
              <dd className="font-semibold text-slate-800">
                {new Date(swim.scheduled_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </dd>
            </div>
          ) : null}
        </dl>
      )}

      {!pickup && !swim && isDashboard && !absence && camper.status !== "inactive" ? (
        <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
          Regular camp day — no schedule changes.
        </p>
      ) : null}
    </>
  );

  if (onView && isDashboard) {
    return (
      <button
        type="button"
        onClick={onView}
        className={cn(
          "pp-card group w-full overflow-hidden text-left transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md active:translate-y-0",
          cardClassName,
          className,
        )}
      >
        <div className={padding}>{body}</div>
        <div className="flex h-12 items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 text-sm font-semibold text-[hsl(var(--pp-brand))] transition-colors group-hover:bg-[hsl(var(--pp-brand-subtle))]">
          View camper
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>
    );
  }

  return (
    <article className={cn("pp-card overflow-hidden", className)}>
      <div className={padding}>{body}</div>
      {onView ? (
        <button
          type="button"
          onClick={onView}
          className="flex h-11 w-full items-center justify-between border-t border-slate-100 px-5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          View details
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </article>
  );
}
