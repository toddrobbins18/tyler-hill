import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCampDateTime } from "@/lib/safeFormatDate";
import { ClipboardList, Loader2, Plus, Search, User } from "lucide-react";
import {
  HealthCenterVisitFormFields,
  emptyHealthCenterVisitForm,
  type HealthCenterVisitFormState,
} from "./HealthCenterVisitFormFields";
import type { HealthCenterVisitExtraFields } from "@/lib/healthCenterVisitOptions";

type CamperRow = {
  id: string;
  name: string;
  group_name?: string | null;
  division?: { name?: string | null } | null;
  leader?: { name?: string | null } | null;
};

type StaffRow = {
  id: string;
  name: string;
  role?: string | null;
};

type VisitRow = {
  id: string;
  admitted_at: string;
  reason?: string | null;
  treatment?: string | null;
  incident_location?: string | null;
  group_name?: string | null;
  counselor_name?: string | null;
  nurse_name?: string | null;
  sent_home?: string | null;
  called_home?: string | null;
  notes?: string | null;
  child_id?: string | null;
  staff_id?: string | null;
  children?: { name?: string | null } | null;
  staff?: { name?: string | null } | null;
};

type Props = {
  children: CamperRow[];
  staff: StaffRow[];
  visits: VisitRow[];
  onVisitLogged: () => void;
  mode?: "full" | "log-only";
};

function visitPersonName(row: VisitRow): string {
  return row.children?.name || row.staff?.name || "Unknown";
}

export default function HealthCenterDayCampPanel({
  children,
  staff,
  visits,
  onVisitLogged,
  mode = "full",
}: Props) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { toast } = useToast();

  const [entityType, setEntityType] = useState<"camper" | "staff">("camper");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [form, setForm] = useState<HealthCenterVisitFormState>(emptyHealthCenterVisitForm());
  const [saving, setSaving] = useState(false);

  const groupOptions = useMemo(() => {
    const names = children
      .map((c) => c.group_name?.trim())
      .filter((n): n is string => Boolean(n));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [children]);

  const counselorOptions = useMemo(() => {
    const names = [
      ...children.map((c) => c.leader?.name?.trim()).filter(Boolean),
      ...staff.map((s) => s.name?.trim()).filter(Boolean),
    ] as string[];
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [children, staff]);

  const nurseOptions = useMemo(() => {
    const fromVisits = visits
      .map((v) => v.nurse_name?.trim())
      .filter((n): n is string => Boolean(n));
    return [...new Set(fromVisits)];
  }, [visits]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list =
      entityType === "camper"
        ? children.map((c) => ({
            id: c.id,
            name: c.name,
            subtitle: c.group_name || c.division?.name || "",
          }))
        : staff.map((s) => ({
            id: s.id,
            name: s.name,
            subtitle: s.role || "Staff",
          }));
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q),
    );
  }, [children, staff, entityType, search]);

  const selectedCamper =
    entityType === "camper" ? children.find((c) => c.id === selectedId) : undefined;

  const selectPerson = (id: string) => {
    setSelectedId(id);
    if (entityType === "camper") {
      const camper = children.find((c) => c.id === id);
      if (camper) {
        setForm((prev) => ({
          ...prev,
          group_name: camper.group_name || camper.division?.name || prev.group_name,
          counselor_name: camper.leader?.name || prev.counselor_name,
        }));
      }
    }
  };

  const logVisit = async () => {
    if (!currentCompany?.id || !selectedId) {
      toast({ title: "Select a camper or staff member", variant: "destructive" });
      return;
    }
    if (!form.reason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date();
      const [y, m, d] = visitDate.split("-").map(Number);
      const admittedAt = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());

      const extra: HealthCenterVisitExtraFields = {
        treatment: form.treatment || null,
        incident_location: form.incident_location || null,
        group_name: form.group_name || null,
        counselor_name: form.counselor_name || null,
        nurse_name: form.nurse_name || null,
        sent_home: form.sent_home || null,
        called_home: form.called_home || null,
      };

      const insertData: Record<string, unknown> = {
        company_id: currentCompany.id,
        season: currentSeason,
        visit_type: "observation",
        reason: form.reason.trim(),
        notes: form.notes?.trim() || null,
        admitted_at: admittedAt.toISOString(),
        checked_out_at: admittedAt.toISOString(),
        admitted_by: user?.id,
        checked_out_by: user?.id,
        ...extra,
      };

      if (entityType === "camper") {
        insertData.child_id = selectedId;
      } else {
        insertData.staff_id = selectedId;
      }

      const { error } = await supabase.from("health_center_admissions").insert(insertData);
      if (error) throw error;

      toast({ title: "Visit logged" });
      setForm(emptyHealthCenterVisitForm());
      setSelectedId(null);
      setSearch("");
      onVisitLogged();
    } catch (err) {
      console.error(err);
      toast({
        title: "Could not log visit",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => b.admitted_at.localeCompare(a.admitted_at)),
    [visits],
  );

  if (mode === "log-only") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Visit Log
          </CardTitle>
          <CardDescription>Airtable-style health center visits this season</CardDescription>
        </CardHeader>
        <CardContent>
          <VisitLogTable visits={sortedVisits} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Log Health Center Visit
          </CardTitle>
          <CardDescription>
            Select camper or staff, then fill in visit details like your Airtable log
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="space-y-2">
              <Label htmlFor="visit-date">Date</Label>
              <Input
                id="visit-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 p-1 bg-muted rounded-lg max-w-xs">
            <Button
              type="button"
              variant={entityType === "camper" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => {
                setEntityType("camper");
                setSelectedId(null);
              }}
            >
              Campers
            </Button>
            <Button
              type="button"
              variant={entityType === "staff" ? "secondary" : "ghost"}
              size="sm"
              className="flex-1"
              onClick={() => {
                setEntityType("staff");
                setSelectedId(null);
              }}
            >
              Staff
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Search {entityType === "camper" ? "campers" : "staff"}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Type a name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
            {filteredPeople.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No matches</p>
            ) : (
              filteredPeople.slice(0, 50).map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-accent/50 transition-colors ${
                    selectedId === person.id ? "bg-accent" : ""
                  }`}
                  onClick={() => selectPerson(person.id)}
                >
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{person.name}</p>
                    {person.subtitle ? (
                      <p className="text-xs text-muted-foreground truncate">{person.subtitle}</p>
                    ) : null}
                  </div>
                  {selectedId === person.id && (
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      Selected
                    </Badge>
                  )}
                </button>
              ))
            )}
          </div>

          {selectedId && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <p className="text-sm font-medium">
                Visit for{" "}
                <span className="text-primary">
                  {filteredPeople.find((p) => p.id === selectedId)?.name ||
                    selectedCamper?.name}
                </span>
              </p>
              <HealthCenterVisitFormFields
                value={form}
                onChange={setForm}
                groupOptions={groupOptions}
                counselorOptions={counselorOptions}
                nurseOptions={nurseOptions}
                disabled={saving}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedId(null);
                    setForm(emptyHealthCenterVisitForm());
                  }}
                  disabled={saving}
                >
                  Clear
                </Button>
                <Button onClick={logVisit} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Log visit"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Recent visits
          </CardTitle>
          <CardDescription>{sortedVisits.length} visits this season</CardDescription>
        </CardHeader>
        <CardContent>
          <VisitLogTable visits={sortedVisits.slice(0, 100)} />
        </CardContent>
      </Card>
    </div>
  );
}

function VisitLogTable({ visits }: { visits: VisitRow[] }) {
  if (visits.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">No visits logged yet</p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="p-2 font-medium">Date</th>
            <th className="p-2 font-medium">Name</th>
            <th className="p-2 font-medium">Reason</th>
            <th className="p-2 font-medium">Treatment</th>
            <th className="p-2 font-medium">Location</th>
            <th className="p-2 font-medium">Group</th>
            <th className="p-2 font-medium">Counselor</th>
            <th className="p-2 font-medium">Nurse</th>
            <th className="p-2 font-medium">Sent home</th>
            <th className="p-2 font-medium">Called home</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((row) => (
            <tr key={row.id} className="border-b align-top hover:bg-muted/30">
              <td className="p-2 whitespace-nowrap">{formatCampDateTime(row.admitted_at)}</td>
              <td className="p-2 font-medium whitespace-nowrap">{visitPersonName(row)}</td>
              <td className="p-2 max-w-[200px]">{row.reason || "—"}</td>
              <td className="p-2 max-w-[160px]">{row.treatment || "—"}</td>
              <td className="p-2 whitespace-nowrap">{row.incident_location || "—"}</td>
              <td className="p-2 whitespace-nowrap">{row.group_name || "—"}</td>
              <td className="p-2 whitespace-nowrap">{row.counselor_name || "—"}</td>
              <td className="p-2 whitespace-nowrap">{row.nurse_name || "—"}</td>
              <td className="p-2 whitespace-nowrap">{row.sent_home || "—"}</td>
              <td className="p-2 max-w-[120px]">{row.called_home || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
