import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, parse, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { compareByLastName } from "@/lib/nameSortUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/SortableHeader";
import { useSortable } from "@/hooks/use-sortable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Waves, Mail, Search, CheckCircle2, AlertCircle, Trophy, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───
type BraceletColor = "Red" | "Orange" | "Yellow" | "Green" | "Blue";
type SkillStatus = "Achieved" | "Working Towards" | "—";
type LevelStatus = "Complete" | "Incomplete" | "—";

interface RosterChild {
  id: string;
  name: string;
  group_name: string | null;
  leader: { name: string } | null;
}

interface BraceletRecord {
  id: string;
  name: string;
  group: string;
  divisionLeader: string;
  currentBracelet: BraceletColor | "";
  proctor1: string; date1: string; note1: string;
  proctor2: string; date2: string; note2: string;
  proctor3: string; date3: string; note3: string;
  emailSent: boolean;
}

interface LevelRecord {
  id: string;
  name: string;
  group: string;
  goldfish: SkillStatus[]; // 4 sub-skills
  goldfishLevel: LevelStatus;
  minnow: SkillStatus[]; // 6 sub-skills
  minnowLevel: LevelStatus;
  tadpole: SkillStatus[]; // 4 sub-skills (1C1..1C4)
  tadpoleLevel: LevelStatus;
  redCross: LevelStatus;
  redCross2: LevelStatus;
  redCross3: LevelStatus;
  redCross4: LevelStatus;
  frog: LevelStatus;
  lastModified: string;
}

const PROCTORS = ["MF", "JT", "VS", "KL", "AR"];
const BRACELETS: BraceletColor[] = ["Red", "Orange", "Yellow", "Green", "Blue"];
const CAMPERS_PAGE_SIZE = 1000;

const levelFromSkills = (skills: SkillStatus[]): LevelStatus => {
  if (skills.every(s => s === "Achieved")) return "Complete";
  if (skills.some(s => s !== "—")) return "Incomplete";
  return "—";
};

const emptySkills4 = (): SkillStatus[] => ["—", "—", "—", "—"];
const emptySkills6 = (): SkillStatus[] => ["—", "—", "—", "—", "—", "—"];

function rosterGroup(child: RosterChild): string {
  return child.group_name?.trim() || "—";
}

function rosterDivisionLeader(child: RosterChild): string {
  return child.leader?.name?.trim() || "—";
}

function braceletFromChild(child: RosterChild): BraceletRecord {
  return {
    id: child.id,
    name: child.name,
    group: rosterGroup(child),
    divisionLeader: rosterDivisionLeader(child),
    currentBracelet: "",
    proctor1: "", date1: "", note1: "",
    proctor2: "", date2: "", note2: "",
    proctor3: "", date3: "", note3: "",
    emailSent: false,
  };
}

function levelFromChild(child: RosterChild): LevelRecord {
  const goldfish = emptySkills4();
  const minnow = emptySkills6();
  const tadpole = emptySkills4();
  return {
    id: child.id,
    name: child.name,
    group: rosterGroup(child),
    goldfish,
    goldfishLevel: levelFromSkills(goldfish),
    minnow,
    minnowLevel: levelFromSkills(minnow),
    tadpole,
    tadpoleLevel: levelFromSkills(tadpole),
    redCross: "—",
    redCross2: "—",
    redCross3: "—",
    redCross4: "—",
    frog: "—",
    lastModified: "—",
  };
}

function mergeBracelets(existing: Map<string, BraceletRecord>, children: RosterChild[]): BraceletRecord[] {
  return children.map((child) => {
    const prev = existing.get(child.id);
    const rosterFields = {
      name: child.name,
      group: rosterGroup(child),
      divisionLeader: rosterDivisionLeader(child),
    };
    return prev ? { ...prev, ...rosterFields } : braceletFromChild(child);
  });
}

function mergeLevels(existing: Map<string, LevelRecord>, children: RosterChild[]): LevelRecord[] {
  return children.map((child) => {
    const prev = existing.get(child.id);
    const rosterFields = { name: child.name, group: rosterGroup(child) };
    return prev ? { ...prev, ...rosterFields } : levelFromChild(child);
  });
}

async function fetchRosterChildren(companyId: string, season: string): Promise<RosterChild[]> {
  const rows: RosterChild[] = [];
  let from = 0;

  for (;;) {
    const to = from + CAMPERS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("children")
      .select("id, name, group_name, leader:leader_id(name)")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("name")
      .range(from, to);

    if (error) throw error;
    const batch = (data ?? []) as RosterChild[];
    rows.push(...batch);
    if (batch.length < CAMPERS_PAGE_SIZE) break;
    from += CAMPERS_PAGE_SIZE;
  }

  rows.sort(compareByLastName);
  return rows;
}

// ─── UI helpers ───
const BRACELET_STYLES: Record<BraceletColor, string> = {
  Red: "bg-red-500/20 text-red-300 border-red-500/40",
  Orange: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  Yellow: "bg-yellow-500/20 text-yellow-200 border-yellow-500/40",
  Green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  Blue: "bg-sky-500/20 text-sky-300 border-sky-500/40",
};

const editableSelect = "h-7 rounded-md border border-border/60 bg-background/60 px-2 text-xs font-medium text-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer";
const editableInput = "h-7 w-full rounded-md border border-border/60 bg-background/60 px-2 text-xs text-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40";

function BraceletSelect({ value, onChange }: { value: BraceletColor | ""; onChange: (v: BraceletColor | "") => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as BraceletColor | "")}
      onClick={e => e.stopPropagation()}
      className={cn(editableSelect, value && BRACELET_STYLES[value as BraceletColor])}
    >
      <option value="">—</option>
      {BRACELETS.map(c => <option key={c} value={c} className="bg-background text-foreground">{c}</option>)}
    </select>
  );
}

function ProctorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={cn(editableSelect, value && "bg-primary/15 text-primary border-primary/30")}
    >
      <option value="">—</option>
      {PROCTORS.map(p => <option key={p} value={p} className="bg-background text-foreground">{p}</option>)}
    </select>
  );
}

function TextEdit({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder || "—"}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={cn(editableInput, "min-w-[90px]")}
    />
  );
}

const DATE_FMT = "MMMM d, yyyy";

function parseStoredDate(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, DATE_FMT, new Date());
  if (isValid(d)) return d;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : undefined;
}

function DateEdit({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = parseStoredDate(value);
  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      // Default to today the first time the calendar is opened with no value set
      if (o && !value) onChange(format(new Date(), DATE_FMT));
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(editableInput, "min-w-[110px] flex items-center gap-1 text-left", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="h-3 w-3 opacity-60" />
          <span className="truncate">{value || "Pick date"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, DATE_FMT));
              setOpen(false);
            }
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

const PASS_OPTIONS = ["Passed", "Did Not Pass", "Retest"] as const;
type PassStatus = (typeof PASS_OPTIONS)[number] | "";

function PassSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPass = value === "Passed";
  const isFail = value === "Did Not Pass";
  const styles = isPass
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : isFail
    ? "bg-red-500/15 text-red-300 border-red-500/30"
    : value
    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableSelect, styles)}
    >
      <option value="">—</option>
      {PASS_OPTIONS.map(p => (
        <option key={p} value={p} className="bg-background text-foreground">{p}</option>
      ))}
    </select>
  );
}

function SkillSelect({ value, onChange }: { value: SkillStatus; onChange: (v: SkillStatus) => void }) {
  const styles =
    value === "Achieved" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
    value === "Working Towards" ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : "";
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as SkillStatus)}
      onClick={e => e.stopPropagation()}
      className={cn(editableSelect, "text-[10px]", styles)}
    >
      <option value="—" className="bg-background text-foreground">—</option>
      <option value="Achieved" className="bg-background text-foreground">Achieved</option>
      <option value="Working Towards" className="bg-background text-foreground">Working Towards</option>
    </select>
  );
}

function LevelSelect({ value, onChange }: { value: LevelStatus; onChange: (v: LevelStatus) => void }) {
  const styles =
    value === "Complete" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
    value === "Incomplete" ? "bg-amber-500/15 text-amber-300 border-amber-500/40" : "";
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as LevelStatus)}
      onClick={e => e.stopPropagation()}
      className={cn(editableSelect, "text-[11px] font-semibold", styles)}
    >
      <option value="—" className="bg-background text-foreground">—</option>
      <option value="Complete" className="bg-background text-foreground">Complete</option>
      <option value="Incomplete" className="bg-background text-foreground">Incomplete</option>
    </select>
  );
}

function BraceletPill({ color }: { color: BraceletColor | "" }) {
  if (!color) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Badge variant="outline" className={cn("font-medium", BRACELET_STYLES[color])}>
      ● {color}
    </Badge>
  );
}

function ProctorChip({ value }: { value: string }) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-semibold text-primary border border-primary/30">
      {value}
    </span>
  );
}

function SkillCell({ status }: { status: SkillStatus }) {
  if (status === "—") return <span className="text-muted-foreground text-xs">—</span>;
  const styles =
    status === "Achieved"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : "bg-sky-500/15 text-sky-300 border-sky-500/30";
  return <Badge variant="outline" className={cn("text-[10px] font-medium whitespace-nowrap", styles)}>{status === "Working Towards" ? "Working Tow…" : status}</Badge>;
}

function LevelPill({ status }: { status: LevelStatus }) {
  if (status === "—") return <span className="text-muted-foreground text-xs">—</span>;
  const styles =
    status === "Complete"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return <Badge variant="outline" className={cn("text-[11px] font-semibold", styles)}>{status}</Badge>;
}



// ─── Page ───
export default function SwimProgram() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [search, setSearch] = useState("");
  const [braceletData, setBraceletData] = useState<BraceletRecord[]>([]);
  const [levelData, setLevelData] = useState<LevelRecord[]>([]);
  const [selectedBraceletId, setSelectedBraceletId] = useState<string | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCompany?.id) {
      setBraceletData([]);
      setLevelData([]);
      return;
    }

    let cancelled = false;

    fetchRosterChildren(currentCompany.id, currentSeason)
      .then((children) => {
        if (cancelled) return;
        setBraceletData((prev) => {
          const existing = new Map(prev.map((b) => [b.id, b]));
          return mergeBracelets(existing, children);
        });
        setLevelData((prev) => {
          const existing = new Map(prev.map((l) => [l.id, l]));
          return mergeLevels(existing, children);
        });
      })
      .catch((err) => {
        console.error("Swim roster load error:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [currentCompany?.id, currentSeason]);

  const selectedBracelet = braceletData.find(b => b.id === selectedBraceletId) || null;
  const selectedLevel = levelData.find(l => l.id === selectedLevelId) || null;

  const updateBracelet = (id: string, patch: Partial<BraceletRecord>) => {
    setBraceletData(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const updateLevel = (id: string, patch: Partial<LevelRecord> | ((r: LevelRecord) => Partial<LevelRecord>)) => {
    setLevelData(prev => prev.map(r => {
      if (r.id !== id) return r;
      const p = typeof patch === "function" ? patch(r) : patch;
      return { ...r, ...p, lastModified: "Just now" };
    }));
  };

  const updateSkill = (id: string, group: "goldfish" | "minnow" | "tadpole", idx: number, value: SkillStatus) => {
    updateLevel(id, r => {
      const next = [...r[group]];
      next[idx] = value;
      const levelKey = `${group}Level` as "goldfishLevel" | "minnowLevel" | "tadpoleLevel";
      return { [group]: next, [levelKey]: levelFromSkills(next) } as Partial<LevelRecord>;
    });
  };

  const filteredBracelets = useMemo(
    () => braceletData.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.group.toLowerCase().includes(search.toLowerCase())),
    [search, braceletData],
  );
  const filteredLevels = useMemo(
    () => levelData.filter(b => b.name.toLowerCase().includes(search.toLowerCase()) || b.group.toLowerCase().includes(search.toLowerCase())),
    [search, levelData],
  );

  const { sorted: sortedBracelets, sort: braceletSort, handleSort: requestBraceletSort } = useSortable(filteredBracelets, { key: "name", direction: "asc" });
  const { sorted: sortedLevels, sort: levelSort, handleSort: requestLevelSort } = useSortable(filteredLevels, { key: "name", direction: "asc" });

  // Stats
  const braceletCounts = BRACELETS.reduce<Record<string, number>>((acc, c) => {
    acc[c] = braceletData.filter(b => b.currentBracelet === c).length;
    return acc;
  }, {});
  const totalCompleteLevels = levelData.reduce((acc, r) => acc + [r.goldfishLevel, r.minnowLevel, r.tadpoleLevel, r.redCross, r.redCross2, r.redCross3, r.redCross4, r.frog].filter(s => s === "Complete").length, 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
            <Waves className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Swim Program</h1>
            <p className="text-sm text-muted-foreground">Bracelet tracking and skill-level reporting</p>
          </div>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search camper or group…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {BRACELETS.map(color => (
          <Card key={color} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <BraceletPill color={color} />
                <span className="text-2xl font-bold">{braceletCounts[color]}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">campers</p>
            </CardContent>
          </Card>
        ))}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Trophy className="h-4 w-4 text-emerald-400" />
              <span className="text-2xl font-bold">{totalCompleteLevels}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">levels complete</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bracelets" className="w-full">
        <TabsList>
          <TabsTrigger value="bracelets">Swim Bracelets</TabsTrigger>
          <TabsTrigger value="levels">Swim Level Report</TabsTrigger>
        </TabsList>

        {/* ─── Bracelets ─── */}
        <TabsContent value="bracelets" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current bracelet status & test history</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="Name" sortKey="name" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Group" sortKey="group" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Division Leader" sortKey="divisionLeader" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Current Bracelet" sortKey="currentBracelet" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="1st Proctor" sortKey="proctor1" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="1st Date" sortKey="date1" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="1st Note" sortKey="note1" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="2nd Proctor" sortKey="proctor2" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="2nd Date" sortKey="date2" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="3rd Proctor" sortKey="proctor3" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="3rd Date" sortKey="date3" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Email" sortKey="emailSent" currentSort={braceletSort} onSort={requestBraceletSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBracelets.map(b => (
                    <TableRow key={b.id} className="cursor-pointer" onDoubleClick={() => setSelectedBraceletId(b.id)}>
                      <TableCell className="font-medium" onClick={() => setSelectedBraceletId(b.id)}>{b.name}</TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => setSelectedBraceletId(b.id)}>{b.group}</TableCell>
                      <TableCell><Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{b.divisionLeader.split(" ")[0]}</Badge></TableCell>
                      <TableCell><BraceletSelect value={b.currentBracelet} onChange={v => updateBracelet(b.id, { currentBracelet: v })} /></TableCell>
                      <TableCell><ProctorSelect value={b.proctor1} onChange={v => updateBracelet(b.id, { proctor1: v })} /></TableCell>
                      <TableCell><DateEdit value={b.date1} onChange={v => updateBracelet(b.id, { date1: v })} /></TableCell>
                      <TableCell><PassSelect value={b.note1} onChange={v => updateBracelet(b.id, { note1: v })} /></TableCell>
                      <TableCell><ProctorSelect value={b.proctor2} onChange={v => updateBracelet(b.id, { proctor2: v })} /></TableCell>
                      <TableCell><DateEdit value={b.date2} onChange={v => updateBracelet(b.id, { date2: v })} /></TableCell>
                      <TableCell><ProctorSelect value={b.proctor3} onChange={v => updateBracelet(b.id, { proctor3: v })} /></TableCell>
                      <TableCell><DateEdit value={b.date3} onChange={v => updateBracelet(b.id, { date3: v })} /></TableCell>
                      <TableCell>
                        {b.emailSent ? (
                          <button onClick={(e) => { e.stopPropagation(); updateBracelet(b.id, { emailSent: false }); }} title="Mark as not sent">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); updateBracelet(b.id, { emailSent: true }); toast({ title: "Email queued", description: `Bracelet notice to ${b.name}'s family.` }); }}>
                            <Mail className="h-3 w-3 mr-1" /> Send
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Level Report ─── */}
        <TabsContent value="levels" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Skill checklist by level</span>
                <span className="text-xs font-normal text-muted-foreground">Click a row for full breakdown</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="Child's Name" sortKey="name" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Group" sortKey="group" currentSort={levelSort} onSort={requestLevelSort} />
                    {[1, 2, 3, 4].map(n => <SortableHeader key={`g${n}`} label={`Goldfish 1A${n}`} sortKey={`goldfish.${n - 1}`} currentSort={levelSort} onSort={requestLevelSort} />)}
                    <SortableHeader label="Goldfish Level" sortKey="goldfishLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    {[1, 2, 3, 4, 5, 6].map(n => <SortableHeader key={`m${n}`} label={`Minnow 1B${n}`} sortKey={`minnow.${n - 1}`} currentSort={levelSort} onSort={requestLevelSort} />)}
                    <SortableHeader label="Minnow Level" sortKey="minnowLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    {[1, 2, 3, 4].map(n => <SortableHeader key={`t${n}`} label={`Tadpole 1C${n}`} sortKey={`tadpole.${n - 1}`} currentSort={levelSort} onSort={requestLevelSort} />)}
                    <SortableHeader label="Tadpole Level" sortKey="tadpoleLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Red Cross L1" sortKey="redCross" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Red Cross L2" sortKey="redCross2" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Red Cross L3" sortKey="redCross3" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Red Cross L4" sortKey="redCross4" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Frog Level" sortKey="frog" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Last Modified" sortKey="lastModified" currentSort={levelSort} onSort={requestLevelSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLevels.map(r => (
                    <TableRow key={r.id} className="cursor-pointer" onDoubleClick={() => setSelectedLevelId(r.id)}>
                      <TableCell className="font-medium whitespace-nowrap" onClick={() => setSelectedLevelId(r.id)}>{r.name}</TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => setSelectedLevelId(r.id)}>{r.group}</TableCell>
                      {r.goldfish.map((s, i) => <TableCell key={`g${i}`}><SkillSelect value={s} onChange={v => updateSkill(r.id, "goldfish", i, v)} /></TableCell>)}
                      <TableCell><LevelSelect value={r.goldfishLevel} onChange={v => updateLevel(r.id, { goldfishLevel: v })} /></TableCell>
                      {r.minnow.map((s, i) => <TableCell key={`m${i}`}><SkillSelect value={s} onChange={v => updateSkill(r.id, "minnow", i, v)} /></TableCell>)}
                      <TableCell><LevelSelect value={r.minnowLevel} onChange={v => updateLevel(r.id, { minnowLevel: v })} /></TableCell>
                      {r.tadpole.map((s, i) => <TableCell key={`t${i}`}><SkillSelect value={s} onChange={v => updateSkill(r.id, "tadpole", i, v)} /></TableCell>)}
                      <TableCell><LevelSelect value={r.tadpoleLevel} onChange={v => updateLevel(r.id, { tadpoleLevel: v })} /></TableCell>
                      <TableCell><LevelSelect value={r.redCross} onChange={v => updateLevel(r.id, { redCross: v })} /></TableCell>
                      <TableCell><LevelSelect value={r.redCross2} onChange={v => updateLevel(r.id, { redCross2: v })} /></TableCell>
                      <TableCell><LevelSelect value={r.redCross3} onChange={v => updateLevel(r.id, { redCross3: v })} /></TableCell>
                      <TableCell><LevelSelect value={r.redCross4} onChange={v => updateLevel(r.id, { redCross4: v })} /></TableCell>
                      <TableCell><LevelSelect value={r.frog} onChange={v => updateLevel(r.id, { frog: v })} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.lastModified}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bracelet profile dialog */}
      <Dialog open={!!selectedBracelet} onOpenChange={(o) => !o && setSelectedBraceletId(null)}>
        <DialogContent className="max-w-lg">
          {selectedBracelet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedBracelet.name}</span>
                  <BraceletPill color={selectedBracelet.currentBracelet} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Group</p><p className="font-medium">{selectedBracelet.group}</p></div>
                  <div><p className="text-xs text-muted-foreground">Division Leader</p><p className="font-medium">{selectedBracelet.divisionLeader}</p></div>
                </div>
                <div className="border-t pt-3 space-y-2">
                  {[1, 2, 3].map(n => {
                    const p = selectedBracelet[`proctor${n}` as keyof BraceletRecord] as string;
                    const d = selectedBracelet[`date${n}` as keyof BraceletRecord] as string;
                    const note = selectedBracelet[`note${n}` as keyof BraceletRecord] as string;
                    if (!p) return null;
                    return (
                      <div key={n} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">Test {n}</span>
                          <ProctorChip value={p} />
                          <span className="text-xs text-muted-foreground">{d}</span>
                        </div>
                        {note && <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">{note}</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Level profile dialog */}
      <Dialog open={!!selectedLevel} onOpenChange={(o) => !o && setSelectedLevelId(null)}>
        <DialogContent className="max-w-2xl">
          {selectedLevel && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedLevel.name} <span className="text-sm font-normal text-muted-foreground">· {selectedLevel.group}</span></DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {[
                  { label: "Goldfish", code: "1A", skills: selectedLevel.goldfish, level: selectedLevel.goldfishLevel },
                  { label: "Minnow", code: "1B", skills: selectedLevel.minnow, level: selectedLevel.minnowLevel },
                  { label: "Tadpole", code: "1C", skills: selectedLevel.tadpole, level: selectedLevel.tadpoleLevel },
                ].map(group => (
                  <div key={group.label} className="rounded-lg border bg-card/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">{group.label}</h4>
                      <LevelPill status={group.level} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {group.skills.map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1.5 text-xs">
                          <span className="text-muted-foreground">{group.code}{i + 1}</span>
                          <SkillCell status={s} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["Red Cross L1", selectedLevel.redCross],
                    ["Red Cross L2", selectedLevel.redCross2],
                    ["Red Cross L3", selectedLevel.redCross3],
                    ["Red Cross L4", selectedLevel.redCross4],
                    ["Frog Level", selectedLevel.frog],
                  ] as const).map(([label, status]) => (
                    <div key={label} className="rounded-lg border bg-card/50 p-3 flex items-center justify-between">
                      <span className="text-sm font-semibold">{label}</span>
                      <LevelPill status={status} />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Last modified {selectedLevel.lastModified}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
