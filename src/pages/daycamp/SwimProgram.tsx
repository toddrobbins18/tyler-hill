import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { format, parse, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import {
  BRACELETS,
  DATE_FMT,
  PASS_OPTIONS,
  PROCTORS,
  type BraceletColor,
  type BraceletRecord,
  type LevelRecord,
  type LevelStatus,
  type SkillStatus,
  type SwimHistoryReportRow,
  levelFromSkills,
  fetchSwimHistoryReport,
  fetchSwimRosterChildren,
  fetchSwimSeasons,
  importSwimProgramCsv,
  loadSwimSavedRecords,
  mergeBracelets,
  mergeLevels,
  saveSwimBracelet,
  saveSwimLevel,
  skillStatusLabel,
  swimProgramCsvTemplate,
} from "@/lib/swimProgram";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Waves, Mail, Search, CheckCircle2, AlertCircle, Trophy, CalendarIcon, Upload, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 700;

const BRACELET_STYLES: Record<BraceletColor, string> = {
  Red: "bg-red-500/20 text-red-300 border-red-500/40",
  Orange: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  Yellow: "bg-yellow-500/20 text-yellow-200 border-yellow-500/40",
  Green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  Blue: "bg-sky-500/20 text-sky-300 border-sky-500/40",
};

const editableSelect =
  "h-7 rounded-md border border-border/60 bg-background/60 px-2 text-xs font-medium text-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer";
const editableInput =
  "h-7 w-full rounded-md border border-border/60 bg-background/60 px-2 text-xs text-foreground hover:border-primary/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40";

function BraceletSelect({ value, onChange }: { value: BraceletColor | ""; onChange: (v: BraceletColor | "") => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as BraceletColor | "")}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableSelect, value && BRACELET_STYLES[value as BraceletColor])}
    >
      <option value="">—</option>
      {BRACELETS.map((c) => (
        <option key={c} value={c} className="bg-background text-foreground">
          {c}
        </option>
      ))}
    </select>
  );
}

function ProctorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableSelect, value && "bg-primary/15 text-primary border-primary/30")}
    >
      <option value="">—</option>
      {PROCTORS.map((p) => (
        <option key={p} value={p} className="bg-background text-foreground">
          {p}
        </option>
      ))}
    </select>
  );
}

function TextEdit({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder || "—"}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableInput, "min-w-[90px]")}
    />
  );
}

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
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !value) onChange(format(new Date(), DATE_FMT));
      }}
    >
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
      <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
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
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

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
      {PASS_OPTIONS.map((p) => (
        <option key={p} value={p} className="bg-background text-foreground">
          {p}
        </option>
      ))}
    </select>
  );
}

/** Sheet-style A / W / — toggle */
function SkillToggle({ value, onChange }: { value: SkillStatus; onChange: (v: SkillStatus) => void }) {
  const options: SkillStatus[] = ["—", "A", "W"];
  return (
    <div className="inline-flex rounded-md border border-border/60 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          title={opt === "—" ? "Not started" : skillStatusLabel(opt)}
          onClick={() => onChange(opt)}
          className={cn(
            "h-7 min-w-[1.75rem] px-1.5 text-[10px] font-bold transition-colors",
            value === opt
              ? opt === "A"
                ? "bg-emerald-500/25 text-emerald-200"
                : opt === "W"
                  ? "bg-sky-500/25 text-sky-200"
                  : "bg-muted text-foreground"
              : "bg-background/40 text-muted-foreground hover:bg-muted/60",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function LevelSelect({ value, onChange }: { value: LevelStatus; onChange: (v: LevelStatus) => void }) {
  const styles =
    value === "Complete"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : value === "Incomplete"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
        : "";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as LevelStatus)}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableSelect, "text-[11px] font-semibold", styles)}
    >
      <option value="—" className="bg-background text-foreground">
        —
      </option>
      <option value="Complete" className="bg-background text-foreground">
        Complete
      </option>
      <option value="Incomplete" className="bg-background text-foreground">
        Incomplete
      </option>
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
    status === "A" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-sky-500/15 text-sky-300 border-sky-500/30";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-bold", styles)} title={skillStatusLabel(status)}>
      {status}
    </Badge>
  );
}

function LevelPill({ status }: { status: LevelStatus }) {
  if (status === "—") return <span className="text-muted-foreground text-xs">—</span>;
  const styles =
    status === "Complete" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40";
  return (
    <Badge variant="outline" className={cn("text-[11px] font-semibold", styles)}>
      {status}
    </Badge>
  );
}

export default function SwimProgram() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [search, setSearch] = useState("");
  const [viewSeason, setViewSeason] = useState(currentSeason);
  const [seasonOptions, setSeasonOptions] = useState<string[]>([currentSeason]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyReport, setHistoryReport] = useState<SwimHistoryReportRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [braceletData, setBraceletData] = useState<BraceletRecord[]>([]);
  const [levelData, setLevelData] = useState<LevelRecord[]>([]);
  const [selectedBraceletId, setSelectedBraceletId] = useState<string | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const braceletSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const levelSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setViewSeason(currentSeason);
  }, [currentSeason]);

  const reload = useCallback(async () => {
    if (!currentCompany?.id) {
      setBraceletData([]);
      setLevelData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const children = await fetchSwimRosterChildren(supabase, currentCompany.id, viewSeason);
      const childById = new Map(children.map((c) => [c.id, c]));
      const { bracelets, levels } = await loadSwimSavedRecords(
        supabase,
        currentCompany.id,
        viewSeason,
        childById,
      );
      setBraceletData(mergeBracelets(bracelets, children));
      setLevelData(mergeLevels(levels, children));
    } catch (err) {
      console.error("[SwimProgram] load error:", err);
      toast({ title: "Failed to load swim program", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, viewSeason, toast]);

  const loadHistory = useCallback(async () => {
    if (!currentCompany?.id) {
      setHistoryReport([]);
      return;
    }
    setHistoryLoading(true);
    try {
      setHistoryReport(await fetchSwimHistoryReport(supabase, currentCompany.id));
    } catch (err) {
      console.error("[SwimProgram] history load error:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    fetchSwimSeasons(supabase, currentCompany.id)
      .then((seasons) => setSeasonOptions(seasons.length ? seasons : [currentSeason]))
      .catch(console.error);
    void loadHistory();
  }, [currentCompany?.id, currentSeason, loadHistory]);

  const scheduleBraceletSave = useCallback(
    (record: BraceletRecord) => {
      if (!currentCompany?.id) return;
      const existing = braceletSaveTimers.current.get(record.id);
      if (existing) clearTimeout(existing);
      setSaving(true);
      braceletSaveTimers.current.set(
        record.id,
        setTimeout(() => {
          saveSwimBracelet(supabase, currentCompany.id!, viewSeason, record)
            .catch((err) => {
              console.error(err);
              toast({ title: "Save failed", description: record.name, variant: "destructive" });
            })
            .finally(() => setSaving(false));
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [currentCompany?.id, viewSeason, toast],
  );

  const scheduleLevelSave = useCallback(
    (record: LevelRecord) => {
      if (!currentCompany?.id) return;
      const existing = levelSaveTimers.current.get(record.id);
      if (existing) clearTimeout(existing);
      setSaving(true);
      levelSaveTimers.current.set(
        record.id,
        setTimeout(() => {
          saveSwimLevel(supabase, currentCompany.id!, viewSeason, record)
            .catch((err) => {
              console.error(err);
              toast({ title: "Save failed", description: record.name, variant: "destructive" });
            })
            .finally(() => setSaving(false));
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [currentCompany?.id, viewSeason, toast],
  );

  const updateBracelet = (id: string, patch: Partial<BraceletRecord>) => {
    setBraceletData((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
      const record = next.find((b) => b.id === id);
      if (record) scheduleBraceletSave(record);
      return next;
    });
  };

  const updateLevel = (id: string, patch: Partial<LevelRecord> | ((r: LevelRecord) => Partial<LevelRecord>)) => {
    setLevelData((prev) => {
      const next = prev.map((r) => {
        if (r.id !== id) return r;
        const p = typeof patch === "function" ? patch(r) : patch;
        return { ...r, ...p, lastModified: "Just now" };
      });
      const record = next.find((r) => r.id === id);
      if (record) scheduleLevelSave(record);
      return next;
    });
  };

  const updateSkill = (id: string, group: "goldfish" | "minnow" | "tadpole", idx: number, value: SkillStatus) => {
    updateLevel(id, (r) => {
      const next = [...r[group]];
      next[idx] = value;
      const levelKey = `${group}Level` as "goldfishLevel" | "minnowLevel" | "tadpoleLevel";
      return { [group]: next, [levelKey]: levelFromSkills(next) } as Partial<LevelRecord>;
    });
  };

  const handleCsvImport = async (file: File) => {
    if (!currentCompany?.id) return;
    try {
      const text = await file.text();
      const result = await importSwimProgramCsv(supabase, currentCompany.id, text, viewSeason);
      await reload();
      await loadHistory();
      toast({
        title: "Import complete",
        description: `${result.bracelets} bracelet + ${result.levels} level rows${result.unmatched.length ? ` (${result.unmatched.length} unmatched)` : ""}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Import failed", variant: "destructive" });
    }
  };

  const selectedBracelet = braceletData.find((b) => b.id === selectedBraceletId) || null;
  const selectedLevel = levelData.find((l) => l.id === selectedLevelId) || null;

  const filteredBracelets = useMemo(
    () => braceletData.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.group.toLowerCase().includes(search.toLowerCase())),
    [search, braceletData],
  );
  const filteredLevels = useMemo(
    () => levelData.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()) || b.group.toLowerCase().includes(search.toLowerCase())),
    [search, levelData],
  );

  const { sorted: sortedBracelets, sort: braceletSort, handleSort: requestBraceletSort } = useSortable(filteredBracelets, {
    key: "name",
    direction: "asc",
  });
  const { sorted: sortedLevels, sort: levelSort, handleSort: requestLevelSort } = useSortable(filteredLevels, {
    key: "name",
    direction: "asc",
  });

  const braceletCounts = BRACELETS.reduce<Record<string, number>>((acc, c) => {
    acc[c] = braceletData.filter((b) => b.currentBracelet === c).length;
    return acc;
  }, {});
  const totalCompleteLevels = levelData.reduce(
    (acc, r) =>
      acc +
      [r.goldfishLevel, r.minnowLevel, r.tadpoleLevel, r.redCross, r.redCross2, r.redCross3, r.redCross4, r.frog].filter(
        (s) => s === "Complete",
      ).length,
    0,
  );

  return (
    <div className="space-y-6 p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
            <Waves className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Swim Program</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : `${braceletData.length} campers`} · season {viewSeason}
              {saving ? " · saving…" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCsvImport(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Select value={viewSeason} onValueChange={setViewSeason}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent>
              {seasonOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([swimProgramCsvTemplate()], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "swim-program-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Template
          </Button>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search camper or group…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {BRACELETS.map((color) => (
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

      <Tabs defaultValue="bracelets" className="w-full">
        <TabsList>
          <TabsTrigger value="bracelets">Swim Bracelets</TabsTrigger>
          <TabsTrigger value="levels">Swim Level Report</TabsTrigger>
          <TabsTrigger value="history">Prior Seasons Report</TabsTrigger>
        </TabsList>

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
                  {sortedBracelets.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer" onDoubleClick={() => setSelectedBraceletId(b.id)}>
                      <TableCell className="font-medium" onClick={() => setSelectedBraceletId(b.id)}>
                        {b.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => setSelectedBraceletId(b.id)}>
                        {b.group}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                          {b.divisionLeader.split(" ")[0]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <BraceletSelect value={b.currentBracelet} onChange={(v) => updateBracelet(b.id, { currentBracelet: v })} />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect value={b.proctor1} onChange={(v) => updateBracelet(b.id, { proctor1: v })} />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date1} onChange={(v) => updateBracelet(b.id, { date1: v })} />
                      </TableCell>
                      <TableCell>
                        <PassSelect value={b.note1} onChange={(v) => updateBracelet(b.id, { note1: v })} />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect value={b.proctor2} onChange={(v) => updateBracelet(b.id, { proctor2: v })} />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date2} onChange={(v) => updateBracelet(b.id, { date2: v })} />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect value={b.proctor3} onChange={(v) => updateBracelet(b.id, { proctor3: v })} />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date3} onChange={(v) => updateBracelet(b.id, { date3: v })} />
                      </TableCell>
                      <TableCell>
                        {b.emailSent ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBracelet(b.id, { emailSent: false });
                            }}
                            title="Mark as not sent"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateBracelet(b.id, { emailSent: true });
                              toast({ title: "Email queued", description: `Bracelet notice to ${b.name}'s family.` });
                            }}
                          >
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

        <TabsContent value="levels" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Skill checklist — A = Achieved, W = Working towards</span>
                <span className="text-xs font-normal text-muted-foreground">Tap A / W / — on each skill</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="Child's Name" sortKey="name" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Group" sortKey="group" currentSort={levelSort} onSort={requestLevelSort} />
                    {[1, 2, 3, 4].map((n) => (
                      <SortableHeader key={`g${n}`} label={`Goldfish 1A${n}`} sortKey={`goldfish.${n - 1}`} currentSort={levelSort} onSort={requestLevelSort} />
                    ))}
                    <SortableHeader label="Goldfish Level" sortKey="goldfishLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SortableHeader key={`m${n}`} label={`Minnow 1B${n}`} sortKey={`minnow.${n - 1}`} currentSort={levelSort} onSort={requestLevelSort} />
                    ))}
                    <SortableHeader label="Minnow Level" sortKey="minnowLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    {[1, 2, 3, 4].map((n) => (
                      <SortableHeader key={`t${n}`} label={`Tadpole 1C${n}`} sortKey={`tadpole.${n - 1}`} currentSort={levelSort} onSort={requestLevelSort} />
                    ))}
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
                  {sortedLevels.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onDoubleClick={() => setSelectedLevelId(r.id)}>
                      <TableCell className="font-medium whitespace-nowrap" onClick={() => setSelectedLevelId(r.id)}>
                        {r.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => setSelectedLevelId(r.id)}>
                        {r.group}
                      </TableCell>
                      {r.goldfish.map((s, i) => (
                        <TableCell key={`g${i}`}>
                          <SkillToggle value={s} onChange={(v) => updateSkill(r.id, "goldfish", i, v)} />
                        </TableCell>
                      ))}
                      <TableCell>
                        <LevelSelect value={r.goldfishLevel} onChange={(v) => updateLevel(r.id, { goldfishLevel: v })} />
                      </TableCell>
                      {r.minnow.map((s, i) => (
                        <TableCell key={`m${i}`}>
                          <SkillToggle value={s} onChange={(v) => updateSkill(r.id, "minnow", i, v)} />
                        </TableCell>
                      ))}
                      <TableCell>
                        <LevelSelect value={r.minnowLevel} onChange={(v) => updateLevel(r.id, { minnowLevel: v })} />
                      </TableCell>
                      {r.tadpole.map((s, i) => (
                        <TableCell key={`t${i}`}>
                          <SkillToggle value={s} onChange={(v) => updateSkill(r.id, "tadpole", i, v)} />
                        </TableCell>
                      ))}
                      <TableCell>
                        <LevelSelect value={r.tadpoleLevel} onChange={(v) => updateLevel(r.id, { tadpoleLevel: v })} />
                      </TableCell>
                      <TableCell>
                        <LevelSelect value={r.redCross} onChange={(v) => updateLevel(r.id, { redCross: v })} />
                      </TableCell>
                      <TableCell>
                        <LevelSelect value={r.redCross2} onChange={(v) => updateLevel(r.id, { redCross2: v })} />
                      </TableCell>
                      <TableCell>
                        <LevelSelect value={r.redCross3} onChange={(v) => updateLevel(r.id, { redCross3: v })} />
                      </TableCell>
                      <TableCell>
                        <LevelSelect value={r.redCross4} onChange={(v) => updateLevel(r.id, { redCross4: v })} />
                      </TableCell>
                      <TableCell>
                        <LevelSelect value={r.frog} onChange={(v) => updateLevel(r.id, { frog: v })} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.lastModified}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Prior seasons — all campers with saved swim data</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {historyLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading history…</p>
              ) : historyReport.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No prior swim data yet. Import Airtable CSV or enter data on Bracelets / Level Report tabs.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableCell className="font-semibold">Camper</TableCell>
                      <TableCell className="font-semibold">Season</TableCell>
                      <TableCell className="font-semibold">Bracelet</TableCell>
                      <TableCell className="font-semibold">Goldfish</TableCell>
                      <TableCell className="font-semibold">Minnow</TableCell>
                      <TableCell className="font-semibold">Tadpole</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyReport.flatMap((row) =>
                      row.seasons.map((s) => (
                        <TableRow key={`${row.personId}-${s.season}`}>
                          <TableCell className="font-medium whitespace-nowrap">{row.name}</TableCell>
                          <TableCell>{s.season}</TableCell>
                          <TableCell>{s.bracelet?.currentBracelet || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {(s.levels?.goldfish ?? []).map((sk, i) => (
                                <SkillCell key={i} status={sk} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {(s.levels?.minnow ?? []).map((sk, i) => (
                                <SkillCell key={i} status={sk} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {(s.levels?.tadpole ?? []).map((sk, i) => (
                                <SkillCell key={i} status={sk} />
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  <div>
                    <p className="text-xs text-muted-foreground">Group</p>
                    <p className="font-medium">{selectedBracelet.group}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Division Leader</p>
                    <p className="font-medium">{selectedBracelet.divisionLeader}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLevel} onOpenChange={(o) => !o && setSelectedLevelId(null)}>
        <DialogContent className="max-w-2xl">
          {selectedLevel && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedLevel.name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">· {selectedLevel.group}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {[
                  { label: "Goldfish", code: "1A", skills: selectedLevel.goldfish, level: selectedLevel.goldfishLevel },
                  { label: "Minnow", code: "1B", skills: selectedLevel.minnow, level: selectedLevel.minnowLevel },
                  { label: "Tadpole", code: "1C", skills: selectedLevel.tadpole, level: selectedLevel.tadpoleLevel },
                ].map((group) => (
                  <div key={group.label} className="rounded-lg border bg-card/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">{group.label}</h4>
                      <LevelPill status={group.level} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {group.skills.map((s, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1.5 text-xs">
                          <span className="text-muted-foreground">
                            {group.code}
                            {i + 1}
                          </span>
                          <SkillCell status={s} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Last modified {selectedLevel.lastModified}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
