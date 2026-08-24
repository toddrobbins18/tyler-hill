import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Check, Mail, Trash2, Upload, Download, UserPlus, FolderPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { parseCSV, pickFirst, readFileAsText } from "@/lib/csv";
import { syncSunshineFromRoster } from "@/lib/sunshineRoster";

type Group = { id: string; name: string; sort_order: number };
type Camper = { id: string; full_name: string; group_id: string | null; parent_email: string | null; sort_order: number };
type TagCategory = "sport" | "activity" | "lunch";
type TagOption = { id: string; category: TagCategory; label: string; color: string };
type Report = {
  id?: string;
  camper_id: string;
  report_date: string;
  sports: string[];
  activities: string[];
  lunch: string[];
  bm: boolean;
  napped: boolean;
  send_email: boolean;
  email_sent_at: string | null;
};

const tagColorClasses: Record<string, string> = {
  blue: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  green: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200",
  pink: "bg-pink-100 text-pink-900 dark:bg-pink-900/30 dark:text-pink-200",
  purple: "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200",
  orange: "bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200",
  yellow: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200",
  teal: "bg-teal-100 text-teal-900 dark:bg-teal-900/30 dark:text-teal-200",
  gray: "bg-gray-100 text-gray-900 dark:bg-gray-700/40 dark:text-gray-200",
};

const normalizeGroupName = (value: string) => value.trim().toLowerCase();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SunshineReport() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [date, setDate] = useState(todayISO());
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [campers, setCampers] = useState<Camper[]>([]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [loading, setLoading] = useState(true);
  const [syncingRoster, setSyncingRoster] = useState(false);

  // Dialog state
  const [addCamperOpen, setAddCamperOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newCamper, setNewCamper] = useState({ full_name: "", parent_email: "", group_id: "" });
  const [newGroup, setNewGroup] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findLocalGroupByName = (name: string) =>
    groups.find((group) => normalizeGroupName(group.name) === normalizeGroupName(name));

  const syncExistingGroup = (group: Group, message: string) => {
    setGroups((prev) => {
      const next = prev.some((current) => current.id === group.id) ? prev : [...prev, group];
      return [...next].sort((a, b) => a.sort_order - b.sort_order);
    });
    setActiveGroupId(group.id);
    setAddGroupOpen(false);
    setNewGroup("");
    toast.info(message);
  };

  async function fetchGroupByName(name: string) {
    if (!currentCompany) return null;
    const trimmedName = name.trim();
    if (!trimmedName) return null;

    const localGroup = findLocalGroupByName(trimmedName);
    if (localGroup) return localGroup;

    const { data, error } = await supabase
      .from("sunshine_groups")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .ilike("name", trimmedName)
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return (data as Group | null) ?? null;
  }

  // Initial load + roster sync
  useEffect(() => {
    if (currentCompany) {
      void refreshAll({ syncRoster: true });
    }
  }, [currentCompany, currentSeason]);

  async function refreshAll(options?: { syncRoster?: boolean }) {
    if (!currentCompany) return;
    if (options?.syncRoster) {
      setSyncingRoster(true);
      try {
        const result = await syncSunshineFromRoster(currentCompany.id, currentSeason);
        if (result.campers === 0) {
          toast.message(
            result.skippedNoGroup > 0
              ? `No groups found — ${result.skippedNoGroup} campers missing FULLSUMMERGROUP. Run CampMinder sync.`
              : "No campers on roster for this season.",
          );
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Could not load roster groups: ${message}`);
      } finally {
        setSyncingRoster(false);
      }
    }

    const [g, c, t] = await Promise.all([
      supabase.from("sunshine_groups").select("*").eq("company_id", currentCompany.id).eq("season", currentSeason).order("sort_order"),
      supabase.from("sunshine_campers").select("*").eq("company_id", currentCompany.id).eq("season", currentSeason).order("sort_order"),
      supabase.from("sunshine_tag_options").select("*").eq("company_id", currentCompany.id).order("sort_order"),
    ]);
    if (g.error) {
      console.error("sunshine_groups load failed:", g.error);
      toast.error("Could not load groups: " + g.error.message);
      setGroups([]);
      setActiveGroupId("");
      return;
    }
    if (g.data) {
      setGroups(g.data);
      setActiveGroupId(g.data.length ? g.data[0].id : "");
    }
    if (c.error) {
      console.error("sunshine_campers load failed:", c.error);
      toast.error("Could not load campers: " + c.error.message);
    } else if (c.data) {
      setCampers(c.data);
    }
    if (t.error) {
      console.error("sunshine_tag_options load failed:", t.error);
    } else if (t.data) {
      setTagOptions(t.data as TagOption[]);
    }
  }

  // Load reports when date changes
  useEffect(() => {
    if (!currentCompany) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sunshine_reports")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("report_date", date);
      const map: Record<string, Report> = {};
      (data || []).forEach((r: any) => {
        map[r.camper_id] = r;
      });
      setReports(map);
      setLoading(false);
    })();
  }, [date, currentCompany]);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const groupCampers = useMemo(
    () => campers.filter((c) => c.group_id === activeGroupId),
    [campers, activeGroupId]
  );

  const sportOptions = tagOptions.filter((t) => t.category === "sport");
  const activityOptions = tagOptions.filter((t) => t.category === "activity");
  const lunchOptions = tagOptions.filter((t) => t.category === "lunch");

  async function upsertReport(camperId: string, patch: Partial<Report>) {
    if (!currentCompany) return;
    const existing = reports[camperId] || {
      camper_id: camperId,
      report_date: date,
      sports: [],
      activities: [],
      lunch: [],
      bm: false,
      napped: false,
      send_email: true,
      email_sent_at: null,
    };
    const next: Report = { ...existing, ...patch };
    setReports((prev) => ({ ...prev, [camperId]: next }));

    const { data, error } = await supabase
      .from("sunshine_reports")
      .upsert(
        {
          company_id: currentCompany.id,
          camper_id: camperId,
          report_date: date,
          sports: next.sports,
          activities: next.activities,
          lunch: next.lunch,
          bm: next.bm,
          napped: next.napped,
          send_email: next.send_email,
          email_sent_at: next.email_sent_at,
        },
        { onConflict: "camper_id,report_date" }
      )
      .select()
      .single();

    if (error) toast.error("Failed to save: " + error.message);
    else if (data) setReports((prev) => ({ ...prev, [camperId]: data as Report }));
  }

  function toggleTag(camperId: string, field: "sports" | "activities" | "lunch", label: string) {
    const r = reports[camperId];
    const current = r?.[field] || [];
    const next = current.includes(label) ? current.filter((x) => x !== label) : [...current, label];
    upsertReport(camperId, { [field]: next });
  }

  async function sendEndOfDayEmails() {
    const toSend = groupCampers.filter((c) => {
      const r = reports[c.id];
      return r?.send_email && !r.email_sent_at && c.parent_email;
    });
    if (!toSend.length) {
      toast.info("No reports queued to send.");
      return;
    }
    const now = new Date().toISOString();
    for (const c of toSend) {
      await supabase
        .from("sunshine_reports")
        .update({ email_sent_at: now })
        .eq("camper_id", c.id)
        .eq("report_date", date);
      setReports((prev) => ({ ...prev, [c.id]: { ...prev[c.id], email_sent_at: now } }));
    }
    toast.success(`Marked ${toSend.length} report${toSend.length === 1 ? "" : "s"} as sent to parents.`);
  }

  // ---- Add / delete ----
  async function handleAddCamper() {
    if (!currentCompany) return;
    const groupId = newCamper.group_id || activeGroupId;
    if (!newCamper.full_name.trim() || !groupId) {
      toast.error("Name and group are required.");
      return;
    }
    const maxOrder = Math.max(0, ...campers.filter((c) => c.group_id === groupId).map((c) => c.sort_order));
    const { data, error } = await supabase
      .from("sunshine_campers")
      .insert({
        company_id: currentCompany.id,
        full_name: newCamper.full_name.trim(),
        parent_email: newCamper.parent_email.trim() || null,
        group_id: groupId,
        sort_order: maxOrder + 1,
        season: currentSeason,
      })
      .select()
      .single();
    if (error) {
      toast.error("Failed to add camper: " + error.message);
      return;
    }
    setCampers((prev) => [...prev, data as Camper]);
    setAddCamperOpen(false);
    setNewCamper({ full_name: "", parent_email: "", group_id: "" });
    toast.success("Camper added.");
  }

  async function handleAddGroup() {
    if (!currentCompany) return;
    const trimmedName = newGroup.trim();
    if (!trimmedName) return;

    const existingGroup = await fetchGroupByName(trimmedName);
    if (existingGroup) {
      syncExistingGroup(existingGroup, `"${existingGroup.name}" already exists — switched to it.`);
      return;
    }

    const maxOrder = Math.max(0, ...groups.map((g) => g.sort_order));
    const { data, error } = await supabase
      .from("sunshine_groups")
      .insert({ company_id: currentCompany.id, name: trimmedName, sort_order: maxOrder + 1, season: currentSeason })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const duplicateGroup = await fetchGroupByName(trimmedName);
        if (duplicateGroup) {
          syncExistingGroup(duplicateGroup, `"${duplicateGroup.name}" already exists — switched to it.`);
          return;
        }
      }
      toast.error("Failed to add group: " + error.message);
      return;
    }

    setGroups((prev) => [...prev, data as Group]);
    setActiveGroupId((data as Group).id);
    setAddGroupOpen(false);
    setNewGroup("");
    toast.success("Group added.");
  }

  async function handleDeleteCamper(id: string, name: string) {
    if (!confirm(`Remove ${name}? This will also delete their reports.`)) return;
    const { error } = await supabase.from("sunshine_campers").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    setCampers((prev) => prev.filter((c) => c.id !== id));
    setReports((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast.success("Camper removed.");
  }

  // ---- CSV import / export ----
  async function handleCSVImport(file: File) {
    if (!currentCompany) return;
    try {
      const text = await readFileAsText(file);
      const rows = parseCSV(text);
      if (!rows.length) {
        toast.error("CSV appears empty.");
        return;
      }
      // Build group lookup by lowercase name
      const groupByName = new Map(groups.map((g) => [normalizeGroupName(g.name), g]));
      let createdGroupCount = 0;
      const newCampersPayload: Array<{ company_id: string; full_name: string; parent_email: string | null; group_id: string; sort_order: number; season: string }> = [];

      // Pre-create any missing groups
      const wantedGroupNames = new Set<string>();
      for (const r of rows) {
        const gName = pickFirst(r, ["group", "group name", "cabin"]).trim();
        if (gName && !groupByName.has(normalizeGroupName(gName))) wantedGroupNames.add(gName);
      }
      let nextOrder = Math.max(0, ...groups.map((g) => g.sort_order));
      for (const name of wantedGroupNames) {
        nextOrder += 1;
        const normalizedName = normalizeGroupName(name);
        const { data, error } = await supabase
          .from("sunshine_groups")
          .insert({ company_id: currentCompany.id, name, sort_order: nextOrder, season: currentSeason })
          .select()
          .single();

        if (error) {
          if (error.code === "23505") {
            const existingGroup = await fetchGroupByName(name);
            if (existingGroup) {
              groupByName.set(normalizedName, existingGroup);
              continue;
            }
          }
          toast.error(`Failed to create group "${name}": ${error.message}`);
          return;
        }

        if (data) {
          groupByName.set(normalizedName, data as Group);
          createdGroupCount++;
        }
      }

      const orderByGroup = new Map<string, number>();
      campers.forEach((c) => {
        if (c.group_id)
          orderByGroup.set(c.group_id, Math.max(orderByGroup.get(c.group_id) ?? 0, c.sort_order));
      });

      let skipped = 0;
      for (const r of rows) {
        const name = pickFirst(r, ["full name", "name", "camper", "child", "child's name", "child name"]).trim();
        const email = pickFirst(r, ["parent email", "email", "parent_email"]).trim();
        const gName = pickFirst(r, ["group", "group name", "cabin"]).trim();
        if (!name) { skipped++; continue; }
        const group = gName ? groupByName.get(normalizeGroupName(gName)) : groups.find((g) => g.id === activeGroupId);
        if (!group) { skipped++; continue; }
        const next = (orderByGroup.get(group.id) ?? 0) + 1;
        orderByGroup.set(group.id, next);
        newCampersPayload.push({
          company_id: currentCompany.id,
          full_name: name,
          parent_email: email || null,
          group_id: group.id,
          sort_order: next,
          season: currentSeason,
        });
      }

      if (!newCampersPayload.length) {
        toast.error("No valid rows found. Expected headers: name, parent_email, group");
        return;
      }
      const { data, error } = await supabase
        .from("sunshine_campers")
        .insert(newCampersPayload)
        .select();
      if (error) {
        toast.error("Import failed: " + error.message);
        return;
      }
      await refreshAll();
      toast.success(
        `Imported ${data?.length ?? 0} camper${data?.length === 1 ? "" : "s"}` +
          (createdGroupCount ? `, created ${createdGroupCount} group${createdGroupCount === 1 ? "" : "s"}` : "") +
          (skipped ? `, skipped ${skipped}` : "") + "."
      );
    } catch (e: any) {
      toast.error("Import error: " + (e?.message || String(e)));
    }
  }

  function handleCSVDownloadTemplate() {
    const csv = "name,parent_email,group\nJane Doe,parent@example.com,Pandas\nJohn Smith,,Bunnies\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sunshine-campers-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!currentCompany) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 text-foreground">Sunshine Report</h1>
          <p className="text-muted-foreground">
            Daily camper tracking — groups and campers load from roster (FULLSUMMERGROUP) for {currentSeason}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCSVImport(f);
              if (e.target) e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={syncingRoster}
            onClick={() => void refreshAll({ syncRoster: true })}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncingRoster && "animate-spin")} />
            {syncingRoster ? "Loading…" : "Reload from Roster"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCSVDownloadTemplate} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddGroupOpen(true)} className="gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> Group
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNewCamper({ full_name: "", parent_email: "", group_id: activeGroupId }); setAddCamperOpen(true); }} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Add Camper
          </Button>
          <Button onClick={sendEndOfDayEmails} className="gap-2">
            <Mail className="h-4 w-4" /> Send to Parents
          </Button>
        </div>
      </div>

      {/* Group tabs */}
      {groups.length > 0 && (
        <Tabs value={activeGroupId} onValueChange={setActiveGroupId}>
          <TabsList>
            {groups.map((g) => (
              <TabsTrigger key={g.id} value={g.id}>
                {g.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {/* Spreadsheet */}
      <Card className="overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10 min-w-[180px]">
                  Child's Name
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[140px]">Group</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[260px]">Sports</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[260px]">Activities</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[260px]">Lunch</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center w-20">BM</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center w-24">Napped?</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center w-28">Send Email</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-32">Sent</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-12"></th>
              </tr>
            </thead>
            <tbody>
              {groupCampers.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="text-center text-muted-foreground py-12">
                    No campers in {activeGroup?.name ?? "this group"}. Click <strong>Add Camper</strong> or <strong>Import CSV</strong> to get started.
                  </td>
                </tr>
              )}
              {groupCampers.map((camper) => {
                const r = reports[camper.id];
                return (
                  <tr key={camper.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 font-medium sticky left-0 bg-card z-10">
                      {camper.full_name}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200 hover:bg-green-100">
                        {activeGroup?.name}
                      </Badge>
                    </td>
                    <TagCell
                      values={r?.sports || []}
                      options={sportOptions}
                      onToggle={(label) => toggleTag(camper.id, "sports", label)}
                    />
                    <TagCell
                      values={r?.activities || []}
                      options={activityOptions}
                      onToggle={(label) => toggleTag(camper.id, "activities", label)}
                    />
                    <TagCell
                      values={r?.lunch || []}
                      options={lunchOptions}
                      onToggle={(label) => toggleTag(camper.id, "lunch", label)}
                    />
                    <td className="px-4 py-2 text-center">
                      <YesNoToggle
                        value={r?.bm ?? false}
                        onChange={(v) => upsertReport(camper.id, { bm: v })}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <YesNoToggle
                        value={r?.napped ?? false}
                        onChange={(v) => upsertReport(camper.id, { napped: v })}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Checkbox
                        checked={r?.send_email ?? true}
                        onCheckedChange={(v) => upsertReport(camper.id, { send_email: !!v })}
                      />
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {r?.email_sent_at ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="h-3 w-3" />
                          {new Date(r.email_sent_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => handleDeleteCamper(camper.id, camper.full_name)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="Remove camper"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Camper dialog */}
      <Dialog open={addCamperOpen} onOpenChange={setAddCamperOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Camper</DialogTitle>
            <DialogDescription>Add a new camper to the daily report.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="camper-name">Full Name</Label>
              <Input
                id="camper-name"
                value={newCamper.full_name}
                onChange={(e) => setNewCamper({ ...newCamper, full_name: e.target.value })}
                placeholder="e.g. Jane Doe"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="camper-email">Parent Email <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="camper-email"
                type="email"
                value={newCamper.parent_email}
                onChange={(e) => setNewCamper({ ...newCamper, parent_email: e.target.value })}
                placeholder="parent@example.com"
              />
            </div>
            <div>
              <Label>Group</Label>
              <Select value={newCamper.group_id} onValueChange={(v) => setNewCamper({ ...newCamper, group_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCamperOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCamper}>Add Camper</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Group dialog */}
      <Dialog open={addGroupOpen} onOpenChange={setAddGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
            <DialogDescription>Create a new group/cabin for organizing campers.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="e.g. Pandas"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleAddGroup}>Add Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TagCell({
  values,
  options,
  onToggle,
}: {
  values: string[];
  options: TagOption[];
  onToggle: (label: string) => void;
}) {
  return (
    <td className="px-4 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex flex-wrap gap-1 items-center min-h-8 w-full text-left rounded-md hover:bg-muted/40 px-1 py-1 transition-colors">
            {values.length === 0 ? (
              <span className="text-muted-foreground/60 text-xs flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add
              </span>
            ) : (
              <>
                {values.map((v) => {
                  const opt = options.find((o) => o.label === v);
                  return (
                    <Badge
                      key={v}
                      variant="secondary"
                      className={cn("rounded-full font-normal hover:opacity-80", tagColorClasses[opt?.color ?? "gray"])}
                    >
                      {v}
                    </Badge>
                  );
                })}
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1 max-h-80 overflow-y-auto" align="start">
          {options.map((opt) => {
            const selected = values.includes(opt.label);
            return (
              <button
                key={opt.id}
                onClick={() => onToggle(opt.label)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm"
              >
                <div className={cn("h-4 w-4 flex items-center justify-center", selected ? "" : "opacity-0")}>
                  <Check className="h-3.5 w-3.5" />
                </div>
                <Badge variant="secondary" className={cn("rounded-full font-normal", tagColorClasses[opt.color])}>
                  {opt.label}
                </Badge>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </td>
  );
}

function YesNoToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "px-3 py-0.5 rounded-full text-xs font-medium transition-colors",
        value
          ? "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200"
          : "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
      )}
    >
      {value ? "Yes" : "No"}
    </button>
  );
}
