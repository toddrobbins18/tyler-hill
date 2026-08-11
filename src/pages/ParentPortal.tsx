import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, LogOut, Plus, Calendar, UserCheck, Clock, Trash2, Waves, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useParentCompany } from "@/hooks/useParentCompany";

type Camper = { id: string; name: string };
type PickupChange = {
  id: string; camper_id: string; change_date: string; change_type: string;
  pickup_time: string | null; pickup_person_name: string | null;
  pickup_person_phone: string | null; notes: string | null; status: string;
};
type Absence = {
  id: string; camper_id: string; absence_date: string; absence_type: string;
  arrival_time: string | null; reason: string | null; notes: string | null; status: string;
};
type AuthorizedPickup = {
  id: string; camper_id: string | null; full_name: string;
  relationship: string | null; phone: string | null; email: string | null;
  notes: string | null; is_active: boolean;
};
type SwimLesson = {
  id: string; camper_id: string; scheduled_at: string; duration_minutes: number;
  instructor: string | null; location: string | null; cost_cents: number;
  status: string; parent_confirmed: boolean; parent_confirmed_at: string | null; notes: string | null;
};

const CHANGE_TYPES = [
  { v: "early_pickup", l: "Early Pickup" },
  { v: "late_stay", l: "Late Stay" },
  { v: "alternate_guardian", l: "Alternate Guardian" },
  { v: "bus_change", l: "Bus / Transport Change" },
  { v: "other", l: "Other" },
];
const ABSENCE_TYPES = [
  { v: "absent", l: "Absent" },
  { v: "late_arrival", l: "Late Arrival" },
  { v: "leaving_early", l: "Leaving Early" },
];

const statusColor = (s: string) =>
  s === "acknowledged" ? "default" : s === "completed" ? "secondary" : s === "cancelled" ? "destructive" : "outline";

export default function ParentPortal() {
  const { user } = useAuth();
  const { companyId, companySlug } = useParentCompany();
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string>("");
  const [campers, setCampers] = useState<Camper[]>([]);
  const [pickups, setPickups] = useState<PickupChange[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [authPickups, setAuthPickups] = useState<AuthorizedPickup[]>([]);
  const [swimLessons, setSwimLessons] = useState<SwimLesson[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!user || !companyId) return;
    const { data: fam } = await supabase
      .from("families")
      .select("id, family_name")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!fam) {
      setLoading(false);
      return;
    }
    setFamilyId(fam.id);
    setFamilyName(fam.family_name);

    const { data: fc } = await supabase
      .from("family_children")
      .select("child_id, children:child_id(id, name)")
      .eq("family_id", fam.id);

    const linkedCampers: Camper[] = (fc ?? [])
      .map((row: { child_id: string; children: { id: string; name: string } | null }) => row.children)
      .filter((c): c is Camper => !!c)
      .sort((a, b) => a.name.localeCompare(b.name));

    const camperIds = linkedCampers.map((c) => c.id);
    const swimQuery =
      camperIds.length > 0
        ? supabase.from("swim_lessons").select("*").in("camper_id", camperIds).order("scheduled_at", { ascending: true })
        : Promise.resolve({ data: [] as SwimLesson[] });

    const [{ data: p }, { data: a }, { data: ap }, { data: sl }] = await Promise.all([
      supabase.from("pickup_changes").select("*").eq("family_id", fam.id).order("change_date", { ascending: false }),
      supabase.from("absences").select("*").eq("family_id", fam.id).order("absence_date", { ascending: false }),
      supabase.from("authorized_pickups").select("*").eq("family_id", fam.id).order("full_name"),
      swimQuery,
    ]);

    setCampers(linkedCampers);
    setPickups(p ?? []);
    setAbsences(a ?? []);
    setAuthPickups(ap ?? []);
    setSwimLessons((sl ?? []) as SwimLesson[]);
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) void loadAll();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [user, companyId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    const q = companySlug ? `?company=${encodeURIComponent(companySlug)}` : "";
    navigate(`/parents${q}`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your portal…</div>;
  }

  if (!familyId) {
    const linkAccount = async () => {
      const defaultName =
        (user?.user_metadata as any)?.full_name?.split(" ").slice(-1)[0] ||
        user?.email?.split("@")[0] ||
        "My";
      if (!companyId) {
        toast.error("Missing camp context");
        return;
      }
      const { error } = await supabase.rpc("register_parent_account", {
        _company_id: companyId,
        _family_name: defaultName,
        _primary_contact_name: (user?.user_metadata as Record<string, unknown>)?.full_name ?? null,
        _phone: null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Family account created");
      setLoading(true);
      await loadAll();
    };
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Account not linked</CardTitle>
            <CardDescription>
              Your account isn't linked to a family yet. Create one now to preview the parent portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={linkAccount}>Create family & continue</Button>
            <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const camperName = (id: string) => campers.find((x) => x.id === id)?.name ?? "—";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">Parent Portal</h1>
              <p className="text-xs text-muted-foreground">{familyName} Family</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6">
        {campers.length === 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">No campers on file yet</CardTitle>
              <CardDescription>
                Once the camp office adds your campers, they'll appear here and you can submit changes.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Tabs defaultValue="pickups">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="pickups"><Calendar className="h-4 w-4 mr-2" />Pickups</TabsTrigger>
            <TabsTrigger value="absences"><Clock className="h-4 w-4 mr-2" />Absences</TabsTrigger>
            <TabsTrigger value="authorized"><UserCheck className="h-4 w-4 mr-2" />Authorized</TabsTrigger>
            <TabsTrigger value="swim"><Waves className="h-4 w-4 mr-2" />Swim Lessons</TabsTrigger>
          </TabsList>

          <TabsContent value="pickups" className="mt-4 space-y-4">
            <PickupChangeDialog companyId={companyId!} familyId={familyId} campers={campers} onSaved={loadAll} />
            <Card>
              <CardHeader><CardTitle className="text-base">Submitted changes</CardTitle></CardHeader>
              <CardContent>
                {pickups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pickup changes yet.</p>
                ) : (
                  <ul className="divide-y">
                    {pickups.map((p) => (
                      <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{camperName(p.camper_id)} · {CHANGE_TYPES.find(t => t.v === p.change_type)?.l ?? p.change_type}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.change_date}{p.pickup_time ? ` at ${p.pickup_time}` : ""}
                            {p.pickup_person_name ? ` · ${p.pickup_person_name}` : ""}
                          </div>
                          {p.notes && <div className="text-xs mt-1">{p.notes}</div>}
                        </div>
                        <Badge variant={statusColor(p.status) as any}>{p.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="absences" className="mt-4 space-y-4">
            <AbsenceDialog companyId={companyId!} familyId={familyId} campers={campers} onSaved={loadAll} />
            <Card>
              <CardHeader><CardTitle className="text-base">Reported absences</CardTitle></CardHeader>
              <CardContent>
                {absences.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No absences reported.</p>
                ) : (
                  <ul className="divide-y">
                    {absences.map((a) => (
                      <li key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{camperName(a.camper_id)} · {ABSENCE_TYPES.find(t => t.v === a.absence_type)?.l ?? a.absence_type}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.absence_date}{a.arrival_time ? ` · arriving ${a.arrival_time}` : ""}
                          </div>
                          {a.reason && <div className="text-xs mt-1">Reason: {a.reason}</div>}
                        </div>
                        <Badge variant={statusColor(a.status) as any}>{a.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authorized" className="mt-4 space-y-4">
            <AuthorizedPickupDialog companyId={companyId!} familyId={familyId} campers={campers} onSaved={loadAll} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approved adults</CardTitle>
                <CardDescription>Anyone here is approved to pick up your camper.</CardDescription>
              </CardHeader>
              <CardContent>
                {authPickups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No authorized pickups added.</p>
                ) : (
                  <ul className="divide-y">
                    {authPickups.map((a) => (
                      <li key={a.id} className="py-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">{a.full_name} {a.relationship && <span className="text-xs text-muted-foreground">· {a.relationship}</span>}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.phone}{a.email ? ` · ${a.email}` : ""}
                            {a.camper_id ? ` · for ${camperName(a.camper_id)}` : " · all campers"}
                          </div>
                        </div>
                        <Button
                          size="icon" variant="ghost"
                          onClick={async () => {
                            const { error } = await supabase.from("authorized_pickups").delete().eq("id", a.id);
                            if (error) toast.error(error.message);
                            else { toast.success("Removed"); loadAll(); }
                          }}
                        ><Trash2 className="h-4 w-4" /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="swim" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your scheduled swim lessons</CardTitle>
                <CardDescription>
                  Lessons are scheduled by the camp. Confirm attendance once you receive the reminder email the day before.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {swimLessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No swim lessons scheduled. Your family will only see lessons here once the camp adds you to the swim program.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {swimLessons.map((l) => {
                      const dt = new Date(l.scheduled_at);
                      const confirm = async () => {
                        const { error } = await supabase
                          .from("swim_lessons")
                          .update({ parent_confirmed: true, parent_confirmed_at: new Date().toISOString() })
                          .eq("id", l.id);
                        if (error) toast.error(error.message);
                        else { toast.success("Attendance confirmed"); loadAll(); }
                      };
                      const unconfirm = async () => {
                        const { error } = await supabase
                          .from("swim_lessons")
                          .update({ parent_confirmed: false, parent_confirmed_at: null })
                          .eq("id", l.id);
                        if (error) toast.error(error.message);
                        else { toast.success("Confirmation cleared"); loadAll(); }
                      };
                      return (
                        <li key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">
                              {camperName(l.camper_id)} · {format(dt, "EEE, MMM d 'at' h:mm a")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {l.duration_minutes} min
                              {l.instructor ? ` · Instructor ${l.instructor}` : ""}
                              {l.location ? ` · ${l.location}` : ""}
                              {" · "}<span className="font-medium text-foreground">${(l.cost_cents / 100).toFixed(2)}</span>
                            </div>
                            {l.notes && <div className="text-xs mt-1">{l.notes}</div>}
                          </div>
                          {l.parent_confirmed ? (
                            <div className="flex items-center gap-2">
                              <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Confirmed</Badge>
                              <Button size="sm" variant="ghost" onClick={unconfirm}>Undo</Button>
                            </div>
                          ) : (
                            <Button size="sm" onClick={confirm}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />Confirm attendance
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------- dialogs ---------- */

function PickupChangeDialog({
  companyId,
  familyId,
  campers,
  onSaved,
}: {
  companyId: string;
  familyId: string;
  campers: Camper[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [camperId, setCamperId] = useState("");
  const [changeDate, setChangeDate] = useState(new Date().toISOString().slice(0, 10));
  const [changeType, setChangeType] = useState("early_pickup");
  const [pickupTime, setPickupTime] = useState("");
  const [personName, setPersonName] = useState("");
  const [personPhone, setPersonPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Pick a camper");
    setSaving(true);
    const { error } = await supabase.from("pickup_changes").insert({
      company_id: companyId,
      family_id: familyId,
      camper_id: camperId,
      change_date: changeDate,
      change_type: changeType,
      pickup_time: pickupTime || null,
      pickup_person_name: personName || null,
      pickup_person_phone: personPhone || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Pickup change submitted");
    setOpen(false); onSaved();
    setPersonName(""); setPersonPhone(""); setNotes(""); setPickupTime("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={campers.length === 0}><Plus className="h-4 w-4 mr-2" />New pickup change</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New pickup change</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Camper</Label>
            <Select value={camperId} onValueChange={setCamperId}>
              <SelectTrigger><SelectValue placeholder="Select camper" /></SelectTrigger>
              <SelectContent>
                {campers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={changeDate} onChange={(e) => setChangeDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={changeType} onValueChange={setChangeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANGE_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Pickup time (optional)</Label>
            <Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Person picking up</Label>
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Their phone</Label>
              <Input value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AbsenceDialog({
  companyId,
  familyId,
  campers,
  onSaved,
}: {
  companyId: string;
  familyId: string;
  campers: Camper[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [camperId, setCamperId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("absent");
  const [arrivalTime, setArrivalTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camperId) return toast.error("Pick a camper");
    setSaving(true);
    const { error } = await supabase.from("absences").insert({
      company_id: companyId,
      family_id: familyId,
      camper_id: camperId,
      absence_date: date,
      absence_type: type,
      arrival_time: arrivalTime || null,
      reason: reason || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Absence reported");
    setOpen(false); onSaved();
    setReason(""); setNotes(""); setArrivalTime("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={campers.length === 0}><Plus className="h-4 w-4 mr-2" />Report absence</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Report absence or late arrival</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Camper</Label>
            <Select value={camperId} onValueChange={setCamperId}>
              <SelectTrigger><SelectValue placeholder="Select camper" /></SelectTrigger>
              <SelectContent>
                {campers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ABSENCE_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(type === "late_arrival" || type === "leaving_early") && (
            <div className="space-y-2">
              <Label>{type === "late_arrival" ? "Arrival time" : "Leaving time"}</Label>
              <Input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Doctor appointment" />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AuthorizedPickupDialog({
  companyId,
  familyId,
  campers,
  onSaved,
}: {
  companyId: string;
  familyId: string;
  campers: Camper[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [camperId, setCamperId] = useState<string>("all");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("authorized_pickups").insert({
      company_id: companyId,
      family_id: familyId,
      full_name: fullName,
      relationship: relationship || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      camper_id: camperId === "all" ? null : camperId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Added authorized pickup");
    setOpen(false); onSaved();
    setFullName(""); setRelationship(""); setPhone(""); setEmail(""); setNotes(""); setCamperId("all");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Add authorized adult</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add authorized adult</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Grandparent, etc." />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Applies to</Label>
            <Select value={camperId} onValueChange={setCamperId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All my campers</SelectItem>
                {campers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
