import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Waves, Plus, Trash2, CheckCircle2, Clock, Bus, Repeat, Phone, XCircle } from "lucide-react";
import { approveDismissalSwim } from "@/lib/dismissalDashboard";
import {
  approveSwimLessonRequest,
  rejectSwimLessonRequest,
  SWIM_LESSON_STATUS_LABELS,
  swimLessonStatusBadgeVariant,
} from "@/lib/swimLessonApproval";
import { toast } from "sonner";
import { campDateTimeToIso, formatCampDate, formatCampTime } from "@/lib/campTime";
import { campDateStringInSeason } from "@/lib/campSeasonDate";
import SearchableChildSelect from "@/components/SearchableChildSelect";
import { SwimLessonRecurringFields } from "@/components/swim/SwimLessonRecurringFields";
import { SwimLessonInstructorSelect } from "@/components/swim/SwimLessonInstructorSelect";
import { SwimLessonTimeSelect } from "@/components/swim/SwimLessonTimeSelect";
import {
  buildSwimLessonRows,
  DEFAULT_SWIM_LESSON_TIME,
  generateRecurringSwimLessonDates,
  resolveSwimLessonWeekCalendar,
  type CampWeekday,
} from "@/lib/swimLessonSchedule";
import {
  loadEnrollmentWeekCalendar,
  type EnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";

type Camper = { id: string; name: string; guardian_email: string | null };
type Lesson = {
  id: string;
  camper_id: string;
  scheduled_at: string;
  duration_minutes: number;
  instructor: string | null;
  location: string | null;
  cost_cents: number;
  status: string;
  parent_confirmed: boolean;
  parent_confirmed_at: string | null;
  transport_status: string | null;
  reminder_sent_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
};

export default function SwimLessons() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [campers, setCampers] = useState<Camper[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!currentCompany?.id) return;
    
    const [{ data: cs }, { data: ls }] = await Promise.all([
      supabase.from("children").select("id, name, guardian_email").eq("company_id", currentCompany.id).eq("season", currentSeason),
      supabase.from("swim_lessons").select("*").eq("company_id", currentCompany.id).order("scheduled_at", { ascending: true }),
    ]);
    
    setCampers((cs ?? []) as Camper[]);
    setLessons((ls ?? []) as Lesson[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [currentCompany?.id, currentSeason]);

  const camperName = (id: string) => {
    const c = campers.find(x => x.id === id);
    return c ? c.name : "—";
  };
  
  const familyEmail = (id: string) => campers.find(f => f.id === id)?.guardian_email ?? "—";

  const remove = async (id: string) => {
    const { error } = await supabase.from("swim_lessons").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lesson removed"); load(); }
  };

  const approveTransport = async (id: string) => {
    const { error } = await approveDismissalSwim(supabase, id);
    if (error) toast.error(error.message);
    else {
      toast.success("Transport approved — camper off bus for lesson run");
      load();
    }
  };

  const approveRequest = async (id: string) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await approveSwimLessonRequest(supabase, id, userRes.user?.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lesson approved — parent can confirm in portal");
      load();
    }
  };

  const rejectRequest = async (id: string) => {
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await rejectSwimLessonRequest(supabase, id, reason, userRes.user?.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lesson request rejected");
      load();
    }
  };

  const pendingLessons = useMemo(
    () => lessons.filter((l) => l.status === "pending"),
    [lessons],
  );
  const activeLessons = useMemo(
    () => lessons.filter((l) => l.status !== "pending" && l.status !== "rejected" && l.status !== "cancelled"),
    [lessons],
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Waves className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Swim Lessons</h1>
            <p className="text-sm text-muted-foreground">
              Approve phone or parent requests, then schedule lessons for families
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PhoneRequestDialog campers={campers} onSaved={load} />
          <LessonDialog campers={campers} onSaved={load} />
        </div>
      </div>

      {pendingLessons.length > 0 ? (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              Pending requests
              <Badge variant="secondary">{pendingLessons.length}</Badge>
            </CardTitle>
            <CardDescription>Phone-ins and parent portal requests — approve or reject.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Camper</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLessons.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{formatCampDate(l.scheduled_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCampTime(l.scheduled_at)} · {l.duration_minutes} min
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{camperName(l.camper_id)}</div>
                      <div className="text-xs text-muted-foreground">{familyEmail(l.camper_id)}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[240px]">
                      {l.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => void approveRequest(l.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void rejectRequest(l.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approved lessons</CardTitle>
          <CardDescription>Parents confirm attendance in the Parent Portal after approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activeLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved lessons yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Camper</TableHead>
                  <TableHead>Parent Email</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Reminder</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLessons.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{formatCampDate(l.scheduled_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCampTime(l.scheduled_at)} · {l.duration_minutes} min
                      </div>
                    </TableCell>
                    <TableCell>{camperName(l.camper_id)}</TableCell>
                    <TableCell>{familyEmail(l.camper_id)}</TableCell>
                    <TableCell>{l.instructor ?? "—"}</TableCell>
                    <TableCell>${(l.cost_cents / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={swimLessonStatusBadgeVariant(l.status)}>
                        {SWIM_LESSON_STATUS_LABELS[l.status as keyof typeof SWIM_LESSON_STATUS_LABELS] ?? l.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {l.parent_confirmed ? (
                        <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Confirmed</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!l.parent_confirmed ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : l.transport_status === "acknowledged" ? (
                        <Badge className="gap-1 bg-emerald-600">
                          <Bus className="h-3 w-3" />
                          No PM bus
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void approveTransport(l.id)}>
                          Approve bus
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {l.reminder_sent_at
                        ? <span className="text-xs text-muted-foreground">Sent {formatCampDate(l.reminder_sent_at)}</span>
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => remove(l.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ScheduleMode = "once" | "recurring";

function PhoneRequestDialog({
  campers,
  onSaved,
}: {
  campers: Camper[];
  onSaved: () => void;
}) {
  const { currentCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const [camperId, setCamperId] = useState("");
  const { currentSeason } = useSeasonContext();
  const [date, setDate] = useState(() => campDateStringInSeason(currentSeason));
  const [time, setTime] = useState(DEFAULT_SWIM_LESSON_TIME);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !camperId) return toast.error("Pick a camper");
    setSaving(true);
    const { error } = await supabase.from("swim_lessons").insert({
      company_id: currentCompany.id,
      camper_id: camperId,
      scheduled_at: campDateTimeToIso(date, time),
      duration_minutes: 30,
      cost_cents: 0,
      status: "pending",
      notes: notes.trim() ? `Phone request: ${notes.trim()}` : "Phone request",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Phone request logged — approve when ready");
    setOpen(false);
    setCamperId("");
    setNotes("");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Phone className="h-4 w-4 mr-2" />
          Log phone request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log phone request</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Camper</Label>
            <SearchableChildSelect
              children={campers}
              value={camperId}
              onValueChange={setCamperId}
              placeholder="Search campers..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Requested date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <SwimLessonTimeSelect value={time} onChange={setTime} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who called, special requests…" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Log request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LessonDialog({
  campers, onSaved,
}: { campers: Camper[]; onSaved: () => void }) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [open, setOpen] = useState(false);
  const [camperId, setCamperId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("once");
  const [weekCalendar, setWeekCalendar] = useState<EnrollmentWeekCalendar>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [selectedDays, setSelectedDays] = useState<CampWeekday[]>([]);
  const [date, setDate] = useState(() => campDateStringInSeason(currentSeason));

  useEffect(() => {
    setDate(campDateStringInSeason(currentSeason));
  }, [currentSeason]);
  const [time, setTime] = useState(DEFAULT_SWIM_LESSON_TIME);
  const [duration, setDuration] = useState("30");
  const [instructor, setInstructor] = useState("");
  const [cost, setCost] = useState("45");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const resolvedCalendar = useMemo(
    () => resolveSwimLessonWeekCalendar(weekCalendar, currentSeason),
    [weekCalendar, currentSeason],
  );

  const recurringDates = useMemo(
    () =>
      scheduleMode === "recurring"
        ? generateRecurringSwimLessonDates(resolvedCalendar, selectedWeeks, selectedDays)
        : [],
    [scheduleMode, resolvedCalendar, selectedWeeks, selectedDays],
  );

  const resetForm = () => {
    setCamperId("");
    setScheduleMode("once");
    setSelectedWeeks([]);
    setSelectedDays([]);
    setDate(campDateStringInSeason(currentSeason));
    setTime(DEFAULT_SWIM_LESSON_TIME);
    setDuration("30");
    setInstructor("");
    setCost("45");
    setNotes("");
  };

  useEffect(() => {
    if (!open || !currentCompany?.id) return;
    void loadEnrollmentWeekCalendar(supabase, currentCompany.id, currentSeason).then(setWeekCalendar);
  }, [open, currentCompany?.id, currentSeason]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;
    if (!camperId) return toast.error("Pick a camper");

    const durationMinutes = parseInt(duration) || 30;
    const costCents = Math.round(parseFloat(cost || "0") * 100);
    const instructorVal = instructor || null;
    const notesVal = notes || null;

    setSaving(true);

    if (scheduleMode === "recurring") {
      if (selectedWeeks.length === 0 || selectedDays.length === 0) {
        setSaving(false);
        return toast.error("Pick at least one week and one day");
      }
      if (recurringDates.length === 0) {
        setSaving(false);
        return toast.error("No lesson dates match your selection");
      }

      const seriesId = crypto.randomUUID();
      const rows = buildSwimLessonRows({
        companyId: currentCompany.id,
        camperId,
        dates: recurringDates,
        time,
        durationMinutes,
        instructor: instructorVal,
        location: null,
        costCents,
        notes: notesVal,
        recurrenceSeriesId: seriesId,
      });

      const { error } = await supabase.from("swim_lessons").insert(rows);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success(`${rows.length} swim lessons scheduled`);
    } else {
      const scheduled_at = campDateTimeToIso(date, time);
      const { error } = await supabase.from("swim_lessons").insert({
        company_id: currentCompany.id,
        camper_id: camperId,
        scheduled_at,
        duration_minutes: durationMinutes,
        instructor: instructorVal,
        cost_cents: costCents,
        notes: notesVal,
        status: "scheduled",
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Swim lesson scheduled");
    }

    setOpen(false);
    resetForm();
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Schedule lesson</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Schedule a swim lesson</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Camper</Label>
            <SearchableChildSelect 
              children={campers} 
              value={camperId} 
              onValueChange={setCamperId} 
              placeholder="Search campers..." 
            />
          </div>

          <div className="space-y-2">
            <Label>Schedule type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scheduleMode === "once" ? "default" : "outline"}
                size="sm"
                onClick={() => setScheduleMode("once")}
              >
                One-time
              </Button>
              <Button
                type="button"
                variant={scheduleMode === "recurring" ? "default" : "outline"}
                size="sm"
                onClick={() => setScheduleMode("recurring")}
              >
                <Repeat className="h-3.5 w-3.5 mr-1.5" />
                Repeat weekly
              </Button>
            </div>
          </div>

          {scheduleMode === "once" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Minutes</Label>
                  <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} />
                </div>
              </div>
              <SwimLessonTimeSelect value={time} onChange={setTime} />
            </div>
          ) : (
            <>
              <SwimLessonTimeSelect value={time} onChange={setTime} />
              <div className="space-y-2">
                <Label>Minutes</Label>
                <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <SwimLessonRecurringFields
                calendar={resolvedCalendar}
                selectedWeeks={selectedWeeks}
                onWeeksChange={setSelectedWeeks}
                selectedDays={selectedDays}
                onDaysChange={setSelectedDays}
                previewCount={recurringDates.length}
              />
            </>
          )}
          <SwimLessonInstructorSelect
            companyId={currentCompany?.id}
            season={currentSeason}
            value={instructor}
            onChange={setInstructor}
          />
          <div className="space-y-2">
            <Label>Cost (USD)</Label>
            <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : scheduleMode === "recurring" && recurringDates.length > 1
                  ? `Schedule ${recurringDates.length} lessons`
                  : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}