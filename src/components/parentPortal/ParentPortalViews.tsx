import { Calendar, CheckCircle2, Clock, Shield, Trash2, UserCheck, Users, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatCampDateTime } from "@/lib/campTime";
import {
  absenceTypeLabel,
  camperInitials,
  changeTypeLabel,
  todayIsoDate,
  type Absence,
  type AuthorizedPickup,
  type Camper,
  type PickupChange,
  type SwimLesson,
} from "@/lib/parentPortalConstants";
import { WelcomeHeader } from "./WelcomeHeader";
import { CamperCard } from "./CamperCard";
import { TodayTimeline } from "./TodayTimeline";
import { QuickActionCard } from "./QuickActionCard";
import { CampAnnouncement } from "./CampAnnouncement";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";
import { PickupChangeDialog } from "./PickupChangeDialog";
import { AbsenceDialog } from "./AbsenceDialog";
import { AuthorizedPickupDialog } from "./AuthorizedPickupDialog";
import type { ParentPortalView } from "@/lib/parentPortalConstants";

type SharedViewProps = {
  campName: string;
  contactName?: string | null;
  companyId: string;
  familyId: string;
  campers: Camper[];
  pickups: PickupChange[];
  absences: Absence[];
  authPickups: AuthorizedPickup[];
  swimLessons: SwimLesson[];
  onSaved: () => void;
  onNavigate: (view: ParentPortalView) => void;
  camperName: (id: string) => string;
};

export function ParentHomeView({
  campName,
  contactName,
  campers,
  pickups,
  absences,
  swimLessons,
  onNavigate,
}: Pick<
  SharedViewProps,
  "campName" | "contactName" | "campers" | "pickups" | "absences" | "swimLessons" | "onNavigate"
>) {
  const todayIso = todayIsoDate();

  return (
    <div className="space-y-8">
      <WelcomeHeader contactName={contactName} campName={campName} />

      <TodayTimeline
        todayIso={todayIso}
        pickups={pickups}
        absences={absences}
        swimLessons={swimLessons}
        camperName={(id) => campers.find((c) => c.id === id)?.name ?? "—"}
      />

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] pp-text-subtle">
              Your family
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Campers</h2>
          </div>
          {campers.length > 0 ? (
            <Button variant="ghost" className="rounded-xl" onClick={() => onNavigate("campers")}>
              View all
            </Button>
          ) : null}
        </div>

        {campers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No campers linked yet"
            description="Once the camp office connects your campers to your family account, they'll appear here with today's schedule and pickup details."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {campers.slice(0, 4).map((camper) => (
              <CamperCard
                key={camper.id}
                camper={camper}
                todayIso={todayIso}
                absences={absences}
                pickups={pickups}
                swimLessons={swimLessons}
                onView={() => onNavigate("campers")}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] pp-text-subtle">
            Things you may want to do
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Quick actions</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <QuickActionCard
            icon={Calendar}
            title="Change pickup"
            description="Request a different pickup arrangement for today or a future date."
            accent="blue"
            onClick={() => onNavigate("pickups")}
          />
          <QuickActionCard
            icon={Clock}
            title="Report an absence"
            description="Let camp know if your child won't attend or will arrive late."
            accent="amber"
            onClick={() => onNavigate("absences")}
          />
          <QuickActionCard
            icon={UserCheck}
            title="Authorized adults"
            description="Manage who is approved to pick up your camper."
            accent="navy"
            onClick={() => onNavigate("authorized")}
          />
          <QuickActionCard
            icon={Waves}
            title="Swim lessons"
            description="View scheduled lessons and confirm attendance."
            accent="green"
            onClick={() => onNavigate("swim")}
          />
        </div>
      </section>

      <CampAnnouncement campName={campName} />
    </div>
  );
}

export function ParentCampersView({
  campers,
  absences,
  pickups,
  swimLessons,
}: Pick<SharedViewProps, "campers" | "absences" | "pickups" | "swimLessons">) {
  const todayIso = todayIsoDate();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">My campers</h1>
        <p className="mt-2 max-w-2xl text-sm pp-text-muted md:text-base">
          A personal overview of each camper in your family — group, today's status, and schedule updates.
        </p>
      </header>

      {campers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No campers on file yet"
          description="When the camp office links your children to your account, their profiles will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campers.map((camper) => (
            <CamperCard
              key={camper.id}
              camper={camper}
              todayIso={todayIso}
              absences={absences}
              pickups={pickups}
              swimLessons={swimLessons}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({
  title,
  meta,
  detail,
  status,
  footer,
}: {
  title: string;
  meta: string;
  detail?: string;
  status: string;
  footer?: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-[hsl(var(--pp-border))] bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm pp-text-muted">{meta}</p>
          {detail ? <p className="mt-2 text-sm">{detail}</p> : null}
        </div>
        <StatusBadge status={status} />
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </article>
  );
}

export function ParentPickupsView({
  companyId,
  familyId,
  campers,
  pickups,
  onSaved,
  camperName,
}: SharedViewProps) {
  const todayIso = todayIsoDate();
  const todayPickups = pickups.filter((p) => p.change_date === todayIso);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Pickups</h1>
          <p className="mt-2 max-w-2xl text-sm pp-text-muted">
            Request pickup changes and track submitted requests.
          </p>
        </div>
        <PickupChangeDialog
          companyId={companyId}
          familyId={familyId}
          campers={campers}
          onSaved={onSaved}
          triggerLabel="Change pickup"
        />
      </header>

      {todayPickups.length > 0 ? (
        <section className="rounded-2xl border border-[hsl(var(--pp-brand-muted))] bg-gradient-to-br from-[hsl(var(--pp-brand-subtle))] to-white p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] pp-text-subtle">
            Today's pickup
          </p>
          <div className="mt-4 space-y-4">
            {todayPickups.map((p) => (
              <div key={p.id} className="rounded-xl bg-white/80 p-4">
                <p className="text-lg font-semibold">{camperName(p.camper_id)}</p>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="pp-text-muted">Change type</span>
                    <p className="font-medium">{changeTypeLabel(p.change_type)}</p>
                  </div>
                  <div>
                    <span className="pp-text-muted">Pickup time</span>
                    <p className="font-medium">{p.pickup_time || "Not specified"}</p>
                  </div>
                  {p.pickup_person_name ? (
                    <div className="sm:col-span-2">
                      <span className="pp-text-muted">Pickup person</span>
                      <p className="font-medium">{p.pickup_person_name}</p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3">
                  <StatusBadge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold">All pickup requests</h2>
        {pickups.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No pickup changes yet"
            description="You're all set! Any pickup requests you submit will appear here."
            action={
              <PickupChangeDialog
                companyId={companyId}
                familyId={familyId}
                campers={campers}
                onSaved={onSaved}
                triggerLabel="Create pickup change"
              />
            }
          />
        ) : (
          <div className="space-y-3">
            {pickups.map((p) => (
              <SubmissionCard
                key={p.id}
                title={`${camperName(p.camper_id)} · ${changeTypeLabel(p.change_type)}`}
                meta={`${p.change_date}${p.pickup_time ? ` at ${p.pickup_time}` : ""}${
                  p.pickup_person_name ? ` · ${p.pickup_person_name}` : ""
                }`}
                detail={p.notes ?? undefined}
                status={p.status}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ParentAbsencesView({
  companyId,
  familyId,
  campers,
  absences,
  onSaved,
  camperName,
}: SharedViewProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Is your camper going to miss a day?
          </h1>
          <p className="mt-2 max-w-2xl text-sm pp-text-muted">
            Report absences, late arrivals, or early departures in just a few taps.
          </p>
        </div>
        <AbsenceDialog
          companyId={companyId}
          familyId={familyId}
          campers={campers}
          onSaved={onSaved}
        />
      </header>

      {absences.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No absences reported"
          description="If your camper won't attend camp or will arrive late, submit a report here so the office can plan accordingly."
          action={
            <AbsenceDialog
              companyId={companyId}
              familyId={familyId}
              campers={campers}
              onSaved={onSaved}
              triggerLabel="Report an absence"
            />
          }
        />
      ) : (
        <div className="space-y-3">
          {absences.map((a) => (
            <SubmissionCard
              key={a.id}
              title={`${camperName(a.camper_id)} · ${absenceTypeLabel(a.absence_type)}`}
              meta={`${a.absence_date}${a.arrival_time ? ` · ${a.arrival_time}` : ""}`}
              detail={a.reason ? `Reason: ${a.reason}` : a.notes ?? undefined}
              status={a.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ParentAuthorizedView({
  companyId,
  familyId,
  campers,
  authPickups,
  onSaved,
  camperName,
}: SharedViewProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Who can pick up your camper?
          </h1>
          <p className="mt-2 max-w-2xl text-sm pp-text-muted">
            Authorized adults are approved by your family for pickup. Keep this list current for everyone's safety.
          </p>
        </div>
        <AuthorizedPickupDialog
          companyId={companyId}
          familyId={familyId}
          campers={campers}
          onSaved={onSaved}
        />
      </header>

      {authPickups.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No authorized adults yet"
          description="Add grandparents, family friends, or other trusted adults who may pick up your camper."
          action={
            <AuthorizedPickupDialog
              companyId={companyId}
              familyId={familyId}
              campers={campers}
              onSaved={onSaved}
            />
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {authPickups.map((adult) => (
            <article
              key={adult.id}
              className="rounded-2xl border border-[hsl(var(--pp-border))] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--pp-brand-soft))] text-base font-semibold text-[hsl(var(--pp-brand-dark))]">
                  {camperInitials(adult.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{adult.full_name}</h3>
                  {adult.relationship ? (
                    <p className="mt-0.5 text-sm pp-text-muted">{adult.relationship}</p>
                  ) : null}
                  <p className="mt-2 text-sm pp-text-muted">
                    {[adult.phone, adult.email].filter(Boolean).join(" · ") || "No contact on file"}
                  </p>
                  <p className="mt-1 text-xs pp-text-subtle">
                    {adult.camper_id ? `For ${camperName(adult.camper_id)}` : "All campers"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="mt-4 rounded-xl text-destructive hover:text-destructive"
                onClick={async () => {
                  const { error } = await supabase.from("authorized_pickups").delete().eq("id", adult.id);
                  if (error) toast.error(error.message);
                  else {
                    toast.success("Removed");
                    onSaved();
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function ParentSwimView({
  swimLessons,
  onSaved,
  camperName,
}: Pick<SharedViewProps, "swimLessons" | "onSaved" | "camperName">) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Swim lessons</h1>
        <p className="mt-2 max-w-2xl text-sm pp-text-muted">
          Lessons are scheduled by the camp. Confirm attendance once you receive your reminder.
        </p>
      </header>

      {swimLessons.length === 0 ? (
        <EmptyState
          icon={Waves}
          title="No swim lessons scheduled"
          description="When the camp adds your family to the swim program, scheduled lessons will appear here for confirmation."
        />
      ) : (
        <div className="space-y-3">
          {swimLessons.map((lesson) => {
            const confirm = async () => {
              const { error } = await supabase
                .from("swim_lessons")
                .update({
                  parent_confirmed: true,
                  parent_confirmed_at: new Date().toISOString(),
                  transport_status: "submitted",
                })
                .eq("id", lesson.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Attendance confirmed");
                onSaved();
              }
            };
            const unconfirm = async () => {
              const { error } = await supabase
                .from("swim_lessons")
                .update({
                  parent_confirmed: false,
                  parent_confirmed_at: null,
                  transport_status: null,
                })
                .eq("id", lesson.id);
              if (error) toast.error(error.message);
              else {
                toast.success("Confirmation cleared");
                onSaved();
              }
            };

            return (
              <article
                key={lesson.id}
                className="rounded-2xl border border-[hsl(var(--pp-border))] bg-gradient-to-br from-[hsl(var(--pp-brand-subtle))] to-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{camperName(lesson.camper_id)}</h3>
                    <p className="mt-1 text-sm pp-text-muted">
                      {formatCampDateTime(lesson.scheduled_at)}
                    </p>
                    <p className="mt-2 text-sm">
                      {lesson.duration_minutes} min
                      {lesson.instructor ? ` · Instructor ${lesson.instructor}` : ""}
                      {lesson.location ? ` · ${lesson.location}` : ""}
                      {" · "}
                      <span className="font-medium">${(lesson.cost_cents / 100).toFixed(2)}</span>
                    </p>
                    {lesson.notes ? (
                      <p className="mt-2 text-sm pp-text-muted">{lesson.notes}</p>
                    ) : null}
                  </div>
                  {lesson.parent_confirmed ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(158_45%_92%)] px-3 py-1 text-xs font-medium text-[hsl(158_40%_28%)]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmed
                      </span>
                      <Button size="sm" variant="ghost" className="rounded-xl" onClick={unconfirm}>
                        Undo
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="rounded-xl" onClick={confirm}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Confirm attendance
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
