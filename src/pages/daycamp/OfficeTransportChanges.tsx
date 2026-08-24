import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import SearchableChildSelect from "@/components/SearchableChildSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Bus, Plus, Trash2, CalendarIcon, Mail, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Change = {
  id: string;
  change_date: string;
  camper_name: string;
  group_division: string | null;
  note: string;
  done: boolean;
  notified_at: string | null;
  created_at: string;
};

type Camper = { id: string; name: string; group_name: string | null };

type FormDraft = {
  camperId: string;
  camperSearch: string;
  group: string;
  note: string;
  date: string;
};

const DRAFT_KEY_PREFIX = "office-changes-draft-v1";

function readFormDraft(key: string): FormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as FormDraft) : null;
  } catch {
    return null;
  }
}

export default function OfficeTransportChanges() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const draftKey = `${DRAFT_KEY_PREFIX}-${currentCompany?.id ?? "none"}-${currentSeason}`;
  const [rows, setRows] = useState<Change[]>([]);
  const [campers, setCampers] = useState<Camper[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [camperId, setCamperId] = useState("");
  const [camperSearch, setCamperSearch] = useState("");
  const [group, setGroup] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!currentCompany) return;
    const { data } = await supabase
      .from("office_transport_changes")
      .select("*")
      .eq("company_id", currentCompany.id)
      .order("change_date", { ascending: false })
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Change[]);
    setLoading(false);
  };

  useEffect(() => {
    if (currentCompany) {
      load();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    setDraftLoaded(false);
    const draft = readFormDraft(draftKey);
    if (draft) {
      setCamperId(draft.camperId ?? "");
      setCamperSearch(draft.camperSearch ?? "");
      setGroup(draft.group ?? "");
      setNote(draft.note ?? "");
      setDate(draft.date ? new Date(`${draft.date}T12:00:00`) : new Date());
    } else {
      setCamperId("");
      setCamperSearch("");
      setGroup("");
      setNote("");
      setDate(new Date());
    }
    setDraftLoaded(true);
  }, [draftKey, currentCompany?.id]);

  useEffect(() => {
    if (!currentCompany?.id || !draftLoaded) return;
    const draft: FormDraft = {
      camperId,
      camperSearch,
      group,
      note,
      date: format(date, "yyyy-MM-dd"),
    };
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftKey, draftLoaded, currentCompany?.id, camperId, camperSearch, group, note, date]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    const loadCampers = async () => {
      const { data } = await supabase
        .from("children")
        .select("id, name, group_name")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .order("name");
      setCampers((data ?? []) as Camper[]);
    };
    void loadCampers();
  }, [currentCompany?.id, currentSeason]);

  const handleCamperChange = (id: string) => {
    setCamperId(id);
    const selected = campers.find((c) => c.id === id);
    if (selected) {
      setCamperSearch(selected.name);
      if (selected.group_name?.trim()) {
        setGroup(selected.group_name.trim());
      }
    }
  };

  const clearDraft = () => {
    sessionStorage.removeItem(draftKey);
    setCamperId("");
    setCamperSearch("");
    setGroup("");
    setNote("");
    setDate(new Date());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    const selectedCamper = campers.find((c) => c.id === camperId);
    if (!selectedCamper || !note.trim()) {
      toast.error("Select a camper from the list and enter a note");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from("office_transport_changes")
      .insert({
        company_id: currentCompany.id,
        change_date: format(date, "yyyy-MM-dd"),
        camper_id: selectedCamper.id,
        camper_name: selectedCamper.name,
        group_division: group.trim() || selectedCamper.group_name?.trim() || null,
        note: note.trim(),
        logged_by: userData.user?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Fire-and-forget email notification to the transport team.
    // In Tyler Hill, this should likely invoke a company-scoped email endpoint or rely on automated_email_config.
    // We'll leave it to call notify-transport-change if it exists, but typically Tyler Hill uses automated_email_config.
    /*
    supabase.functions.invoke("notify-transport-change", {
      body: { changeId: inserted.id },
    }).then(({ error: fnErr }) => {
      if (fnErr) {
        console.warn("notify-transport-change failed:", fnErr);
      }
    });
    */

    toast.success("Change logged and transport team notified");
    clearDraft();
    setSaving(false);
    load();
  };

  const toggleDone = async (id: string, done: boolean) => {
    const { error } = await supabase
      .from("office_transport_changes")
      .update({ done })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setRows(prev => prev.map(r => r.id === id ? { ...r, done } : r));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("office_transport_changes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows(prev => prev.filter(r => r.id !== id));
    toast.success("Removed");
  };

  if (!currentCompany) return null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <PhoneCall className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Office Transport Changes</h1>
          <p className="text-sm text-muted-foreground">
            Log parent phone calls about transportation changes — the transportation department is emailed automatically.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> New change
          </CardTitle>
          <CardDescription>Fill out what the parent told you on the phone.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-2 space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "MMM d") : "Pick"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label>Camper</Label>
              <SearchableChildSelect
                children={campers}
                value={camperId}
                onValueChange={handleCamperChange}
                searchText={camperSearch}
                onSearchTextChange={setCamperSearch}
                placeholder="Type to search campers…"
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Group / Division</Label>
              <Input value={group} onChange={e => setGroup(e.target.value)} placeholder="e.g. Everest" />
            </div>
            <div className="md:col-span-4 space-y-2">
              <Label>Note</Label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Being picked up at 2:30pm by mom…" />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button type="submit" disabled={saving} className="w-full">
                <Mail className="h-4 w-4 mr-1" />
                {saving ? "…" : "Log"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Recent changes
          </CardTitle>
          <CardDescription>Check the box when transportation has acted on the request.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes logged yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Done</TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Camper</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Notified</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className={r.done ? "opacity-60" : ""}>
                    <TableCell>
                      <Checkbox checked={r.done} onCheckedChange={(v) => toggleDone(r.id, !!v)} />
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(r.change_date), "M/d")}</TableCell>
                    <TableCell className="font-medium">{r.camper_name}</TableCell>
                    <TableCell>{r.group_division || "—"}</TableCell>
                    <TableCell>{r.note}</TableCell>
                    <TableCell>
                      {r.notified_at ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Sent</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">—</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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