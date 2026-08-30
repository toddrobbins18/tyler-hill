import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, Calendar, Clock, UserCheck, Waves, Link2, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SearchableChildSelect from "@/components/SearchableChildSelect";

const CHANGE_TYPES: Record<string, string> = {
  early_pickup: "Early Pickup",
  late_stay: "Late Stay",
  alternate_guardian: "Alternate Guardian",
  bus_change: "Bus / Transport Change",
  other: "Other",
};

const ABSENCE_TYPES: Record<string, string> = {
  absent: "Absent",
  late_arrival: "Late Arrival",
  leaving_early: "Leaving Early",
};

const PICKUP_STATUSES = ["submitted", "acknowledged", "completed", "cancelled"] as const;
const ABSENCE_STATUSES = ["submitted", "acknowledged", "cancelled"] as const;

type LinkedChild = { id: string; name: string };
type FamilyRow = {
  id: string;
  family_name: string;
  primary_contact_name: string | null;
  email: string | null;
  phone: string | null;
  user_id: string | null;
  linkedChildren: LinkedChild[];
};

type PickupRow = {
  id: string;
  family_id: string;
  camper_id: string;
  change_date: string;
  change_type: string;
  pickup_time: string | null;
  pickup_person_name: string | null;
  notes: string | null;
  status: string;
  familyName: string;
  camperName: string;
};

type AbsenceRow = {
  id: string;
  family_id: string;
  camper_id: string;
  absence_date: string;
  absence_type: string;
  arrival_time: string | null;
  reason: string | null;
  status: string;
  familyName: string;
  camperName: string;
};

type AuthorizedRow = {
  id: string;
  family_id: string;
  camper_id: string | null;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  familyName: string;
  camperName: string;
};

type SwimRow = {
  id: string;
  camper_id: string;
  scheduled_at: string;
  duration_minutes: number;
  instructor: string | null;
  parent_confirmed: boolean;
  camperName: string;
};

export default function ParentPortalDashboard() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [pickups, setPickups] = useState<PickupRow[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [authorized, setAuthorized] = useState<AuthorizedRow[]>([]);
  const [swimLessons, setSwimLessons] = useState<SwimRow[]>([]);
  const [rosterChildren, setRosterChildren] = useState<LinkedChild[]>([]);

  const load = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const companyId = currentCompany.id;

    const [
      { data: familyData, error: familyErr },
      { data: pickupData, error: pickupErr },
      { data: absenceData, error: absenceErr },
      { data: authData, error: authErr },
      { data: swimData, error: swimErr },
      { data: childData, error: childErr },
    ] = await Promise.all([
      supabase
        .from("families")
        .select(`
          id, family_name, primary_contact_name, email, phone, user_id,
          family_children(child_id, children:child_id(id, name))
        `)
        .eq("company_id", companyId)
        .order("family_name"),
      supabase
        .from("pickup_changes")
        .select(`
          id, family_id, camper_id, change_date, change_type, pickup_time,
          pickup_person_name, notes, status,
          families:family_id(family_name),
          children:camper_id(name)
        `)
        .eq("company_id", companyId)
        .order("change_date", { ascending: false }),
      supabase
        .from("absences")
        .select(`
          id, family_id, camper_id, absence_date, absence_type, arrival_time, reason, status,
          families:family_id(family_name),
          children:camper_id(name)
        `)
        .eq("company_id", companyId)
        .order("absence_date", { ascending: false }),
      supabase
        .from("authorized_pickups")
        .select(`
          id, family_id, camper_id, full_name, relationship, phone, email, is_active,
          families:family_id(family_name),
          children:camper_id(name)
        `)
        .eq("company_id", companyId)
        .order("full_name"),
      supabase
        .from("swim_lessons")
        .select(`
          id, camper_id, scheduled_at, duration_minutes, instructor, parent_confirmed,
          children:camper_id(name, guardian_email)
        `)
        .eq("company_id", companyId)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("children")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("season", currentSeason)
        .neq("status", "inactive")
        .order("name"),
    ]);

    const err = familyErr || pickupErr || absenceErr || authErr || swimErr || childErr;
    if (err) {
      console.error("Parent portal dashboard load error:", err);
      toast.error(err.message);
    }

    setFamilies(
      (familyData ?? []).map((f: any) => ({
        id: f.id,
        family_name: f.family_name,
        primary_contact_name: f.primary_contact_name,
        email: f.email,
        phone: f.phone,
        user_id: f.user_id,
        linkedChildren: (f.family_children ?? [])
          .map((fc: { children: LinkedChild | null }) => fc.children)
          .filter((c: LinkedChild | null): c is LinkedChild => !!c),
      })),
    );

    setPickups(
      (pickupData ?? []).map((p: any) => ({
        id: p.id,
        family_id: p.family_id,
        camper_id: p.camper_id,
        change_date: p.change_date,
        change_type: p.change_type,
        pickup_time: p.pickup_time,
        pickup_person_name: p.pickup_person_name,
        notes: p.notes,
        status: p.status,
        familyName: p.families?.family_name ?? "—",
        camperName: p.children?.name ?? "—",
      })),
    );

    setAbsences(
      (absenceData ?? []).map((a: any) => ({
        id: a.id,
        family_id: a.family_id,
        camper_id: a.camper_id,
        absence_date: a.absence_date,
        absence_type: a.absence_type,
        arrival_time: a.arrival_time,
        reason: a.reason,
        status: a.status,
        familyName: a.families?.family_name ?? "—",
        camperName: a.children?.name ?? "—",
      })),
    );

    setAuthorized(
      (authData ?? []).map((a: any) => ({
        id: a.id,
        family_id: a.family_id,
        camper_id: a.camper_id,
        full_name: a.full_name,
        relationship: a.relationship,
        phone: a.phone,
        email: a.email,
        is_active: a.is_active,
        familyName: a.families?.family_name ?? "—",
        camperName: a.children?.name ?? "All campers",
      })),
    );

    const childNameById = new Map(
      (childData ?? []).map((c: LinkedChild) => [c.id, c.name] as const),
    );

    setSwimLessons(
      (swimData ?? []).map((l: any) => ({
        id: l.id,
        camper_id: l.camper_id,
        scheduled_at: l.scheduled_at,
        duration_minutes: l.duration_minutes,
        instructor: l.instructor,
        parent_confirmed: l.parent_confirmed,
        camperName: l.children?.name ?? childNameById.get(l.camper_id) ?? "—",
      })),
    );

    setRosterChildren((childData ?? []) as LinkedChild[]);
    setLoading(false);
  }, [currentCompany?.id, currentSeason]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingPickups = useMemo(() => pickups.filter((p) => p.status === "submitted").length, [pickups]);
  const pendingAbsences = useMemo(() => absences.filter((a) => a.status === "submitted").length, [absences]);

  const updatePickupStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("pickup_changes").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Pickup updated"); void load(); }
  };

  const updateAbsenceStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("absences").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Absence updated"); void load(); }
  };

  const unlinkChild = async (familyId: string, childId: string) => {
    const { error } = await supabase
      .from("family_children")
      .delete()
      .eq("family_id", familyId)
      .eq("child_id", childId);
    if (error) toast.error(error.message);
    else { toast.success("Camper unlinked"); void load(); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Users className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Portal Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage parent portal submissions for {currentCompany?.name}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{families.length}</div><p className="text-xs text-muted-foreground">Families</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{pendingPickups}</div><p className="text-xs text-muted-foreground">Pending pickups</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{pendingAbsences}</div><p className="text-xs text-muted-foreground">Pending absences</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{authorized.filter((a) => a.is_active).length}</div><p className="text-xs text-muted-foreground">Authorized adults</p></CardContent></Card>
      </div>

      <Tabs defaultValue="families">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="families"><Users className="h-4 w-4 mr-2" />Families</TabsTrigger>
          <TabsTrigger value="pickups"><Calendar className="h-4 w-4 mr-2" />Pickups</TabsTrigger>
          <TabsTrigger value="absences"><Clock className="h-4 w-4 mr-2" />Absences</TabsTrigger>
          <TabsTrigger value="authorized"><UserCheck className="h-4 w-4 mr-2" />Authorized</TabsTrigger>
          <TabsTrigger value="swim"><Waves className="h-4 w-4 mr-2" />Swim</TabsTrigger>
        </TabsList>

        <TabsContent value="families" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Family accounts</CardTitle>
              <CardDescription>Link campers so parents can submit changes in the portal.</CardDescription>
            </CardHeader>
            <CardContent>
              {families.length === 0 ? (
                <p className="text-sm text-muted-foreground">No parent families registered yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Family</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Login</TableHead>
                      <TableHead>Linked campers</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {families.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.family_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {f.primary_contact_name || "—"}
                          {f.email ? ` · ${f.email}` : ""}
                          {f.phone ? ` · ${f.phone}` : ""}
                        </TableCell>
                        <TableCell>
                          {f.user_id ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">No login</Badge>}
                        </TableCell>
                        <TableCell>
                          {f.linkedChildren.length === 0 ? (
                            <span className="text-sm text-muted-foreground">None — link a camper</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {f.linkedChildren.map((c) => (
                                <Badge key={c.id} variant="outline" className="gap-1">
                                  {c.name}
                                  <button type="button" onClick={() => void unlinkChild(f.id, c.id)} aria-label={`Unlink ${c.name}`}>
                                    <Trash2 className="h-3 w-3 opacity-60 hover:opacity-100" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <LinkCamperDialog
                            companyId={currentCompany!.id}
                            familyId={f.id}
                            familyName={f.family_name}
                            rosterChildren={rosterChildren}
                            linkedIds={new Set(f.linkedChildren.map((c) => c.id))}
                            onLinked={load}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pickups" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Pickup changes</CardTitle></CardHeader>
            <CardContent>
              {pickups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pickup changes submitted.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Family</TableHead>
                      <TableHead>Camper</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pickups.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.change_date}</TableCell>
                        <TableCell>{p.familyName}</TableCell>
                        <TableCell>{p.camperName}</TableCell>
                        <TableCell>{CHANGE_TYPES[p.change_type] ?? p.change_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {p.pickup_time ? `${p.pickup_time} · ` : ""}
                          {p.pickup_person_name ?? ""}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </TableCell>
                        <TableCell>
                          <Select value={p.status} onValueChange={(v) => void updatePickupStatus(p.id, v)}>
                            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PICKUP_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absences" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Absences</CardTitle></CardHeader>
            <CardContent>
              {absences.length === 0 ? (
                <p className="text-sm text-muted-foreground">No absences reported.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Family</TableHead>
                      <TableHead>Camper</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {absences.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.absence_date}</TableCell>
                        <TableCell>{a.familyName}</TableCell>
                        <TableCell>{a.camperName}</TableCell>
                        <TableCell>{ABSENCE_TYPES[a.absence_type] ?? a.absence_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.reason ?? "—"}</TableCell>
                        <TableCell>
                          <Select value={a.status} onValueChange={(v) => void updateAbsenceStatus(a.id, v)}>
                            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ABSENCE_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authorized" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Authorized pickups</CardTitle></CardHeader>
            <CardContent>
              {authorized.length === 0 ? (
                <p className="text-sm text-muted-foreground">No authorized adults on file.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Family</TableHead>
                      <TableHead>Camper</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {authorized.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.full_name}
                          {a.relationship ? <span className="text-xs text-muted-foreground"> · {a.relationship}</span> : null}
                        </TableCell>
                        <TableCell>{a.familyName}</TableCell>
                        <TableCell>{a.camperName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.phone ?? "—"}{a.email ? ` · ${a.email}` : ""}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={a.is_active ? "secondary" : "outline"}
                            onClick={async () => {
                              const { error } = await supabase
                                .from("authorized_pickups")
                                .update({ is_active: !a.is_active })
                                .eq("id", a.id);
                              if (error) toast.error(error.message);
                              else void load();
                            }}
                          >
                            {a.is_active ? "Active" : "Inactive"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="swim" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Swim lesson confirmations</CardTitle></CardHeader>
            <CardContent>
              {swimLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No swim lessons scheduled.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Camper</TableHead>
                      <TableHead>Instructor</TableHead>
                      <TableHead>Confirmed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {swimLessons.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{format(new Date(l.scheduled_at), "EEE, MMM d · h:mm a")}</TableCell>
                        <TableCell>{l.camperName}</TableCell>
                        <TableCell>{l.instructor ?? "—"}</TableCell>
                        <TableCell>
                          {l.parent_confirmed ? (
                            <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Yes</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LinkCamperDialog({
  companyId,
  familyId,
  familyName,
  rosterChildren,
  linkedIds,
  onLinked,
}: {
  companyId: string;
  familyId: string;
  familyName: string;
  rosterChildren: LinkedChild[];
  linkedIds: Set<string>;
  onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [saving, setSaving] = useState(false);

  const available = rosterChildren.filter((c) => !linkedIds.has(c.id));

  const submit = async () => {
    if (!childId) return toast.error("Select a camper");
    setSaving(true);
    const { error } = await supabase.from("family_children").insert({
      company_id: companyId,
      family_id: familyId,
      child_id: childId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Linked to ${familyName}`);
    setOpen(false);
    setChildId("");
    onLinked();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={available.length === 0}>
          <Link2 className="h-4 w-4 mr-1" /> Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link camper to {familyName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Camper</Label>
          <SearchableChildSelect
            children={available}
            value={childId}
            onValueChange={setChildId}
            placeholder="Search roster…"
          />
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={saving || !childId}>
            {saving ? "Linking…" : "Link camper"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
