import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Bus, CheckCircle2, Clock, HeartPulse, Plus, Waves } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { campTodayDateString } from "@/lib/parentPortalCutoff";
import { campDateTimeToIso, swimLessonBusRun } from "@/lib/campTime";
import {
  ABSENCE_TYPE_LABELS,
  approveDismissalAbsence,
  approveDismissalNurse,
  approveDismissalPickup,
  approveDismissalSwim,
  DISMISSAL_REALTIME_TABLES,
  fetchDismissalDashboard,
  lookupFamilyIdForCamper,
  PICKUP_CHANGE_LABELS,
  type DismissalDashboardData,
} from "@/lib/dismissalDashboard";
import {
  fetchTransportExceptionsForReport,
  type TransportException,
} from "@/lib/transportDailyOverrides";
import SearchableChildSelect from "@/components/SearchableChildSelect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type Camper = { id: string; name: string; group_name: string | null };

const PICKUP_TYPES = [
  { v: "early_pickup", l: "Early Pickup" },
  { v: "late_stay", l: "Late Stay" },
  { v: "bus_change", l: "Bus / Transport Change" },
  { v: "alternate_guardian", l: "Alternate Guardian" },
  { v: "other", l: "Parent Note" },
];

const ABSENCE_TYPES = [
  { v: "absent", l: "Absent" },
  { v: "late_arrival", l: "Late Arrival" },
  { v: "leaving_early", l: "Leaving Early" },
];

function ExceptionBadge({ ex }: { ex: TransportException }) {
  if (ex.appliedToRoutes) {
    return <Badge className="bg-emerald-600">On bus exception list</Badge>;
  }
  if (ex.workflowStatus === "awaiting parent confirm") {
    return <Badge variant="outline">Awaiting parent</Badge>;
  }
  return <Badge variant="outline" className="border-amber-400 text-amber-800">Pending approval</Badge>;
}

export default function TransportAdminPortal() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [selectedDate, setSelectedDate] = useState(campTodayDateString());
  const [dashboard, setDashboard] = useState<DismissalDashboardData | null>(null);
  const [exceptions, setExceptions] = useState<TransportException[]>([]);
  const [campers, setCampers] = useState<Camper[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentCompany?.id || !currentSeason) return;
    setLoading(true);
    try {
      const [dash, exs, childRes] = await Promise.all([
        fetchDismissalDashboard(supabase, currentCompany.id, currentSeason, selectedDate),
        fetchTransportExceptionsForReport(supabase, currentCompany.id, selectedDate),
        supabase
          .from("children")
          .select("id, name, group_name")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .neq("status", "inactive")
          .order("name"),
      ]);
      setDashboard(dash);
      setExceptions(exs);
      setCampers((childRes.data ?? []) as Camper[]);
    } catch (err) {
      console.error("[TransportAdmin]", err);
      toast.error("Failed to load transport admin data");
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, currentSeason, selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    const channel = supabase.channel(`transport-admin-${currentCompany.id}`);
    for (const table of DISMISSAL_REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `company_id=eq.${currentCompany.id}` },
        () => void load(),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, load]);

  const pendingCount = useMemo(() => {
    if (!dashboard) return 0;
    return (
      dashboard.pendingPickups.length +
      dashboard.pendingAbsences.length +
      dashboard.pendingNurse.length +
      dashboard.pendingSwim.length
    );
  }, [dashboard]);

  const onRoutesCount = useMemo(
    () => exceptions.filter((e) => e.appliedToRoutes).length,
    [exceptions],
  );

  const approvePickup = async (id: string) => {
    const { error } = await approveDismissalPickup(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Approved — will update routes & change sheets when applicable");
      void load();
    }
  };

  const approveAbsence = async (id: string) => {
    const { error } = await approveDismissalAbsence(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Approved");
      void load();
    }
  };

  const approveNurse = async (id: string) => {
    const { error } = await approveDismissalNurse(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Nurse sent-home approved — camper off bus");
      void load();
    }
  };

  const approveSwim = async (id: string) => {
    const { error } = await approveDismissalSwim(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Swim lesson approved — camper off bus for that run");
      void load();
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Bus className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Transport Admin</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Staff backend for bus exceptions — log pickup/absence/swim/nurse changes, approve them,
              then they appear on routes and change sheets (same flow as parent portal submissions).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="admin-date" className="sr-only">Date</Label>
          <Input
            id="admin-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(campTodayDateString())}>
            Today
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Pending staff approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{onRoutesCount}</div>
            <p className="text-xs text-muted-foreground">Active bus exceptions ({selectedDate})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{format(new Date(`${selectedDate}T12:00:00`), "MMM d")}</div>
            <p className="text-xs text-muted-foreground">Selected date</p>
          </CardContent>
        </Card>
      </div>

      {loading && !dashboard ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending approval{pendingCount ? ` (${pendingCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="exceptions">Bus exceptions</TabsTrigger>
            <TabsTrigger value="log">Log change (staff)</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4 space-y-3">
            {pendingCount === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No pending changes for {selectedDate}. Use Log change to add one from the office.
                </CardContent>
              </Card>
            ) : null}
            {dashboard?.pendingPickups.map((p) => (
              <PendingCard
                key={p.id}
                title={p.camperName}
                subtitle={`Pickup · ${PICKUP_CHANGE_LABELS[p.change_type] ?? p.change_type}`}
                detail={[p.familyName, p.pickup_time, p.notes].filter(Boolean).join(" · ")}
                onApprove={() => void approvePickup(p.id)}
              />
            ))}
            {dashboard?.pendingAbsences.map((a) => (
              <PendingCard
                key={a.id}
                title={a.camperName}
                subtitle={`Absence · ${ABSENCE_TYPE_LABELS[a.absence_type] ?? a.absence_type}`}
                detail={[a.familyName, a.reason].filter(Boolean).join(" · ")}
                onApprove={() => void approveAbsence(a.id)}
              />
            ))}
            {dashboard?.pendingNurse.map((n) => (
              <PendingCard
                key={n.id}
                title={n.camper_name}
                subtitle="Nurse · Sent home"
                detail={n.reason ?? undefined}
                onApprove={() => void approveNurse(n.id)}
              />
            ))}
            {dashboard?.pendingSwim.map((s) => (
              <PendingCard
                key={s.id}
                title={s.camperName}
                subtitle="Swim lesson · Parent confirmed"
                detail={s.instructor ?? undefined}
                onApprove={() => void approveSwim(s.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="exceptions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">All transport changes for {selectedDate}</CardTitle>
                <CardDescription>
                  &quot;On bus exception list&quot; = camper removed from AM/PM bus on the route map and change sheets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {exceptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transport changes for this date.</p>
                ) : (
                  exceptions.map((ex, i) => (
                    <div key={`${ex.source}-${ex.camperName}-${i}`} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{ex.camperName}</span>
                        <ExceptionBadge ex={ex} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{ex.label}</p>
                      {ex.detail ? <p className="text-sm mt-1">{ex.detail}</p> : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="log" className="mt-4 grid gap-4 lg:grid-cols-2">
            <StaffPickupForm companyId={currentCompany!.id} campers={campers} date={selectedDate} onSaved={load} />
            <StaffAbsenceForm companyId={currentCompany!.id} campers={campers} date={selectedDate} onSaved={load} />
            <StaffSwimForm companyId={currentCompany!.id} campers={campers} date={selectedDate} onSaved={load} />
            <StaffNurseForm companyId={currentCompany!.id} campers={campers} date={selectedDate} onSaved={load} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PendingCard({
  title,
  subtitle,
  detail,
  onApprove,
}: {
  title: string;
  subtitle: string;
  detail?: string;
  onApprove: () => void;
}) {
  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="py-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-amber-800">{subtitle}</p>
          {detail ? <p className="text-sm text-muted-foreground mt-1">{detail}</p> : null}
        </div>
        <Button size="sm" onClick={onApprove}>
          <CheckCircle2 className="mr-1 h-4 w-4" />
          Approve
        </Button>
      </CardContent>
    </Card>
  );
}

function StaffPickupForm({
  companyId,
  campers,
  date,
  onSaved,
}: {
  companyId: string;
  campers: Camper[];
  date: string;
  onSaved: () => void;
}) {
  const [camperId, setCamperId] = useState("");
  const [changeDate, setChangeDate] = useState(date);
  const [changeType, setChangeType] = useState("early_pickup");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setChangeDate(date), [date]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Select a camper");
    setSaving(true);
    try {
      const familyId = await lookupFamilyIdForCamper(supabase, companyId, camperId);
      if (!familyId) {
        toast.error("Camper is not linked to a family — link them in Portal Dashboard first");
        return;
      }
      const { error } = await supabase.from("pickup_changes").insert({
        company_id: companyId,
        family_id: familyId,
        camper_id: camperId,
        change_date: changeDate,
        change_type: changeType,
        notes: notes || null,
        status: "submitted",
      });
      if (error) throw error;
      toast.success("Pickup logged — approve in Pending tab to update routes");
      setNotes("");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4" /> Log pickup change
        </CardTitle>
        <CardDescription>Same as parent portal — requires approval before bus/routes update.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <SearchableChildSelect children={campers} value={camperId} onValueChange={setCamperId} placeholder="Camper" />
          <Input type="date" value={changeDate} onChange={(e) => setChangeDate(e.target.value)} required />
          <Select value={changeType} onValueChange={setChangeType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PICKUP_TYPES.map((t) => (
                <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" rows={2} />
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Submit for approval"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffAbsenceForm({
  companyId,
  campers,
  date,
  onSaved,
}: {
  companyId: string;
  campers: Camper[];
  date: string;
  onSaved: () => void;
}) {
  const [camperId, setCamperId] = useState("");
  const [absenceDate, setAbsenceDate] = useState(date);
  const [absenceType, setAbsenceType] = useState("absent");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setAbsenceDate(date), [date]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Select a camper");
    setSaving(true);
    try {
      const familyId = await lookupFamilyIdForCamper(supabase, companyId, camperId);
      if (!familyId) {
        toast.error("Camper is not linked to a family");
        return;
      }
      const { error } = await supabase.from("absences").insert({
        company_id: companyId,
        family_id: familyId,
        camper_id: camperId,
        absence_date: absenceDate,
        absence_type: absenceType,
        reason: reason || null,
        status: "submitted",
      });
      if (error) throw error;
      toast.success("Absence logged — approve to update routes");
      setReason("");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Log absence
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <SearchableChildSelect children={campers} value={camperId} onValueChange={setCamperId} placeholder="Camper" />
          <Input type="date" value={absenceDate} onChange={(e) => setAbsenceDate(e.target.value)} required />
          <Select value={absenceType} onValueChange={setAbsenceType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ABSENCE_TYPES.map((t) => (
                <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Submit for approval"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffSwimForm({
  companyId,
  campers,
  date,
  onSaved,
}: {
  companyId: string;
  campers: Camper[];
  date: string;
  onSaved: () => void;
}) {
  const [camperId, setCamperId] = useState("");
  const [lessonDate, setLessonDate] = useState(date);
  const [time, setTime] = useState("10:00");
  const [staffConfirmed, setStaffConfirmed] = useState(true);
  const [instructor, setInstructor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setLessonDate(date), [date]);

  const busRun = useMemo(() => {
    if (!lessonDate || !time) return null;
    try {
      return swimLessonBusRun(campDateTimeToIso(lessonDate, time));
    } catch {
      return null;
    }
  }, [lessonDate, time]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Select a camper");
    setSaving(true);
    try {
      const scheduled_at = campDateTimeToIso(lessonDate, time);
      const { error } = await supabase.from("swim_lessons").insert({
        company_id: companyId,
        camper_id: camperId,
        scheduled_at,
        duration_minutes: 30,
        instructor: instructor || null,
        parent_confirmed: staffConfirmed,
        parent_confirmed_at: staffConfirmed ? new Date().toISOString() : null,
        transport_status: staffConfirmed ? "submitted" : null,
      });
      if (error) throw error;
      toast.success(
        staffConfirmed
          ? "Swim lesson logged — approve to remove camper from bus"
          : "Swim lesson scheduled — parent must confirm, then staff approves",
      );
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Waves className="h-4 w-4" /> Log swim lesson (bus exception)
        </CardTitle>
        <CardDescription>
          Camper skips {busRun ? `${busRun.toUpperCase()} bus` : "AM or PM bus"} when approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <SearchableChildSelect children={campers} value={camperId} onValueChange={setCamperId} placeholder="Camper" />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} required />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <Input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder="Instructor (optional)" />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={staffConfirmed} onCheckedChange={(c) => setStaffConfirmed(!!c)} />
            Staff confirmed (skip parent confirm — still needs transport approval)
          </label>
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Schedule lesson"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffNurseForm({
  companyId,
  campers,
  date,
  onSaved,
}: {
  companyId: string;
  campers: Camper[];
  date: string;
  onSaved: () => void;
}) {
  const [camperId, setCamperId] = useState("");
  const [recordDate, setRecordDate] = useState(date);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setRecordDate(date), [date]);

  const camperName = campers.find((c) => c.id === camperId)?.name ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId || !camperName) return toast.error("Select a camper");
    setSaving(true);
    try {
      const child = campers.find((c) => c.id === camperId);
      const { error } = await supabase.from("nurse_records").insert({
        company_id: companyId,
        date: recordDate,
        camper_name: camperName,
        group_name: child?.group_name ?? null,
        reason: reason || null,
        sent_home: true,
        transport_status: "submitted",
      });
      if (error) throw error;
      toast.success("Sent home logged — approve to remove camper from bus");
      setReason("");
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <HeartPulse className="h-4 w-4" /> Nurse sent home (bus exception)
        </CardTitle>
        <CardDescription>Removes camper from AM &amp; PM bus when approved.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <SearchableChildSelect children={campers} value={camperId} onValueChange={setCamperId} placeholder="Camper" />
          <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
          <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Log sent home"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
