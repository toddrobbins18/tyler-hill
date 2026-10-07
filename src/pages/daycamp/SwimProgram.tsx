import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { format, parse, isValid } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import {
  BRACELETS,
  DATE_FMT,
  SWIM_LEVEL_REPORT_VIEWS,
  fetchSwimDivisionLeaderOptions,
  fetchSwimProctorOptions,
  isBlankDivisionLeader,
  matchDivisionLeaderOption,
  mergeDivisionLeaderOptions,
  mergeProctorOptions,
  mergeSwimTestNoteOptions,
  normalizeSwimTestNote,
  saveSwimBraceletsBulk,
  swimLevelColumnVisible,
  type BraceletColor,
  type SwimLevelReportView,
  type BraceletRecord,
  type LevelRecord,
  type LevelStatus,
  type SkillStatus,
  type SwimHistoryReportRow,
  type SwimImportProgress,
  levelFromSkills,
  fetchSwimHistoryReport,
  fetchSwimRosterChildren,
  importSwimProgramCsv,
  loadSwimSavedRecords,
  mergeBracelets,
  mergeLevels,
  saveSwimBracelet,
  saveSwimLevel,
  skillStatusLabel,
  swimProgramCsvTemplate,
} from "@/lib/swimProgram";
import { sendSwimProgressEmail } from "@/lib/swimProgressApi";
import { buildSwimProgressPdf } from "@/lib/swimProgressPdf";
import { swimProgressEmailSupported } from "@/lib/swimProgressSkills";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { SortableHeader } from "@/components/SortableHeader";
import { SwimGroupFormationPanel } from "@/components/swim/SwimGroupFormationPanel";
import { useSortable } from "@/hooks/use-sortable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import {
  Waves,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  Trophy,
  CalendarIcon,
  Upload,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SAVE_DEBOUNCE_MS = 700;
const SWIM_TABLE_PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_SWIM_PAGE_SIZE = 50;

type LevelDataFilter = "all" | "has-data" | "empty" | "imported";
type BraceletAssignmentFilter = "all" | "assigned" | "unassigned";

type PaginatedSlice<T> = {
  rows: T[];
  total: number;
  totalPages: number;
  page: number;
  rangeStart: number;
  rangeEnd: number;
};

function matchesSwimSearch(name: string, group: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q) || group.toLowerCase().includes(q);
}

function paginateRows<T>(rows: T[], page: number, pageSize: number): PaginatedSlice<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return {
    rows: rows.slice(start, end),
    total,
    totalPages,
    page: safePage,
    rangeStart: total ? start + 1 : 0,
    rangeEnd: end,
  };
}

function buildPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

type SwimImportResult = {
  fileName: string;
  season: string;
  finishedAt: string;
  levels: number;
  bracelets: number;
  matched: number;
  unmatched: string[];
};

function levelRecordHasData(record: LevelRecord): boolean {
  return (
    record.goldfish.some((s) => s !== "—") ||
    record.minnow.some((s) => s !== "—") ||
    record.tadpole.some((s) => s !== "—") ||
    record.exitSkills.some((s) => s !== "—") ||
    [record.goldfishLevel, record.minnowLevel, record.tadpoleLevel, record.redCross, record.redCross2, record.redCross3, record.redCross4, record.frog].some(
      (s) => s !== "—",
    )
  );
}

const BRACELET_STYLES: Record<BraceletColor, string> = {
  "Non Swimmer/Beginner": "bg-violet-500/15 text-violet-200 border-violet-500/35",
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

function ProctorSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const merged = useMemo(() => mergeProctorOptions(options, value ? [value] : []), [options, value]);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableSelect, value && "bg-primary/15 text-primary border-primary/30")}
    >
      <option value="">—</option>
      {merged.map((p) => (
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

function DivisionLeaderSelect({
  value,
  onChange,
  options: baseOptions,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const options = useMemo(
    () => mergeDivisionLeaderOptions([...baseOptions, ...(value ? [value] : [])]),
    [baseOptions, value],
  );
  const displayValue = isBlankDivisionLeader(value) ? "" : matchDivisionLeaderOption(value);
  return (
    <select
      value={displayValue}
      onChange={(e) => onChange(e.target.value ? matchDivisionLeaderOption(e.target.value) : "")}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableSelect, "min-w-[110px]", displayValue && "bg-primary/10 text-primary border-primary/30")}
    >
      <option value="">—</option>
      {options.map((leader) => (
        <option key={leader} value={leader} className="bg-background text-foreground">
          {leader}
        </option>
      ))}
    </select>
  );
}

function TestNoteSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const normalized = normalizeSwimTestNote(value) || value;
  const options = useMemo(() => mergeSwimTestNoteOptions(value ? [value] : []), [value]);
  const isPass = normalized === "PASSED";
  const isRefused = normalized === "Refused";
  const styles = isPass
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : isRefused
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : normalized
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "";
  return (
    <select
      value={normalized}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cn(editableSelect, "min-w-[140px] max-w-[200px]", styles)}
    >
      <option value="">—</option>
      {options.map((note) => (
        <option key={note} value={note} className="bg-background text-foreground">
          {note}
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

function SwimFilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[130px] rounded-md border border-border/60 bg-background px-2 text-xs"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SwimTableFooter({
  slice,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyMessage,
}: {
  slice: PaginatedSlice<unknown>;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  emptyMessage?: string;
}) {
  if (slice.total === 0) {
    return (
      <div className="border-t px-4 py-3 text-sm text-muted-foreground">
        {emptyMessage ?? "No rows match the current filters."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          Showing {slice.rangeStart}–{slice.rangeEnd} of {slice.total}
        </span>
        <SwimFilterSelect
          label="Per page"
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={SWIM_TABLE_PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
          className="min-w-0"
        />
      </div>
      {slice.totalPages > 1 ? (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, slice.page - 1))}
                className={slice.page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
            {buildPageNumbers(slice.page, slice.totalPages).map((page, idx) => (
              <PaginationItem key={`${page}-${idx}`}>
                {page === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    onClick={() => onPageChange(page)}
                    isActive={slice.page === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(slice.totalPages, slice.page + 1))}
                className={slice.page === slice.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
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

type SwimProgramProps = {
  defaultTab?: "bracelets" | "levels" | "formation" | "history";
};

export default function SwimProgram({ defaultTab = "bracelets" }: SwimProgramProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyReport, setHistoryReport] = useState<SwimHistoryReportRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [inactiveHidden, setInactiveHidden] = useState(0);
  const [braceletData, setBraceletData] = useState<BraceletRecord[]>([]);
  const [levelData, setLevelData] = useState<LevelRecord[]>([]);
  const [selectedBraceletId, setSelectedBraceletId] = useState<string | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [proctorOptions, setProctorOptions] = useState<string[]>([]);
  const [divisionLeaderOptions, setDivisionLeaderOptions] = useState<string[]>([]);
  const [bulkDivisionLeader, setBulkDivisionLeader] = useState("");
  const [bulkAssigningLeaders, setBulkAssigningLeaders] = useState(false);
  const [levelReportView, setLevelReportView] = useState<SwimLevelReportView>("red-cross-1");
  const [tablePageSize, setTablePageSize] = useState(DEFAULT_SWIM_PAGE_SIZE);
  const [braceletPage, setBraceletPage] = useState(1);
  const [levelPage, setLevelPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [braceletGroupFilter, setBraceletGroupFilter] = useState("all");
  const [braceletColorFilter, setBraceletColorFilter] = useState("all");
  const [braceletAssignmentFilter, setBraceletAssignmentFilter] = useState<BraceletAssignmentFilter>("all");
  const [levelGroupFilter, setLevelGroupFilter] = useState("all");
  const [levelDataFilter, setLevelDataFilter] = useState<LevelDataFilter>("all");
  const [progressEmailSendingId, setProgressEmailSendingId] = useState<string | null>(null);
  const [historySeasonFilter, setHistorySeasonFilter] = useState("all");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<SwimImportProgress | null>(null);
  const [lastImport, setLastImport] = useState<SwimImportResult | null>(null);
  const braceletSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const levelSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBraceletPage(1);
  }, [search, braceletGroupFilter, braceletColorFilter, braceletAssignmentFilter, currentSeason, tablePageSize]);

  useEffect(() => {
    setLevelPage(1);
  }, [search, levelGroupFilter, levelDataFilter, levelReportView, currentSeason, tablePageSize]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    setHistoryPage(1);
  }, [search, historySeasonFilter, tablePageSize]);

  const syncSwimData = useCallback(
    async (options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? false;
      if (!currentCompany?.id) {
        setBraceletData([]);
        setLevelData([]);
        setInactiveHidden(0);
        setLoading(false);
        return;
      }
      if (showLoading) setLoading(true);
      try {
        const { children, inactiveHidden: hiddenInactive } = await fetchSwimRosterChildren(
          supabase,
          currentCompany.id,
          currentSeason,
        );
        setInactiveHidden(hiddenInactive);
        const childById = new Map(children.map((c) => [c.id, c]));
        const { bracelets, levels } = await loadSwimSavedRecords(
          supabase,
          currentCompany.id,
          currentSeason,
          childById,
        );
        setBraceletData(mergeBracelets(bracelets, children));
        setLevelData(mergeLevels(levels, children));
        const [proctors, divisionLeaders] = await Promise.all([
          fetchSwimProctorOptions(supabase, currentCompany.id, currentSeason),
          fetchSwimDivisionLeaderOptions(supabase, currentCompany.id, currentSeason),
        ]);
        setProctorOptions(proctors);
        setDivisionLeaderOptions(divisionLeaders);
      } catch (err) {
        console.error("[SwimProgram] load error:", err);
        if (showLoading) {
          toast({ title: "Failed to load swim program", variant: "destructive" });
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [currentCompany?.id, currentSeason, toast],
  );

  const reload = useCallback(() => syncSwimData({ showLoading: true }), [syncSwimData]);

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

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`swim-program-records-${currentCompany.id}-${currentSeason}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "swim_program_records",
          filter: `company_id=eq.${currentCompany.id}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { season?: string } | null;
          if (row?.season && row.season !== currentSeason) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            void syncSwimData({ showLoading: false });
          }, 350);
        },
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, currentSeason, syncSwimData]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    void loadHistory();
  }, [currentCompany?.id, loadHistory]);

  const scheduleBraceletSave = useCallback(
    (record: BraceletRecord) => {
      if (!currentCompany?.id) return;
      const existing = braceletSaveTimers.current.get(record.id);
      if (existing) clearTimeout(existing);
      setSaving(true);
      braceletSaveTimers.current.set(
        record.id,
        setTimeout(() => {
          saveSwimBracelet(supabase, currentCompany.id!, currentSeason, record)
            .catch((err) => {
              console.error(err);
              toast({ title: "Save failed", description: record.name, variant: "destructive" });
            })
            .finally(() => setSaving(false));
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [currentCompany?.id, currentSeason, toast],
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
          saveSwimLevel(supabase, currentCompany.id!, currentSeason, record)
            .catch((err) => {
              console.error(err);
              toast({ title: "Save failed", description: record.name, variant: "destructive" });
            })
            .finally(() => setSaving(false));
        }, SAVE_DEBOUNCE_MS),
      );
    },
    [currentCompany?.id, currentSeason, toast],
  );

  const updateBracelet = (id: string, patch: Partial<BraceletRecord>) => {
    setBraceletData((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...patch } : b));
      const record = next.find((b) => b.id === id);
      if (record) scheduleBraceletSave(record);
      return next;
    });
  };

  const assignDivisionLeaderBulk = async (leader: string, targets: BraceletRecord[]) => {
    if (!currentCompany?.id || !leader.trim() || !targets.length) return;
    const normalizedLeader = matchDivisionLeaderOption(leader);
    setBulkAssigningLeaders(true);
    try {
      const targetIds = new Set(targets.map((b) => b.id));
      const updated = braceletData.map((b) =>
        targetIds.has(b.id) ? { ...b, divisionLeader: normalizedLeader } : b,
      );
      const toSave = updated.filter((b) => targetIds.has(b.id));
      setBraceletData(updated);
      await saveSwimBraceletsBulk(supabase, currentCompany.id, currentSeason, toSave);
      toast({
        title: "Division leaders assigned",
        description: `${normalizedLeader} → ${toSave.length} camper${toSave.length === 1 ? "" : "s"}`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Bulk assign failed", variant: "destructive" });
      await syncSwimData({ showLoading: false });
    } finally {
      setBulkAssigningLeaders(false);
    }
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

  const updateSkill = (
    id: string,
    group: "goldfish" | "minnow" | "tadpole" | "exit",
    idx: number,
    value: SkillStatus,
  ) => {
    updateLevel(id, (r) => {
      if (group === "exit") {
        const next = [...r.exitSkills];
        next[idx] = value;
        return { exitSkills: next };
      }
      const next = [...r[group]];
      next[idx] = value;
      const levelKey = `${group}Level` as "goldfishLevel" | "minnowLevel" | "tadpoleLevel";
      return { [group]: next, [levelKey]: levelFromSkills(next) } as Partial<LevelRecord>;
    });
  };

  const handleSendProgressEmail = async (record: LevelRecord) => {
    if (!currentCompany?.id || progressEmailSendingId) return;
    if (levelReportView === "all" || !swimProgressEmailSupported(levelReportView)) return;

    setProgressEmailSendingId(record.id);
    try {
      const pdf = await buildSwimProgressPdf({
        levelId: levelReportView,
        levels: record,
        childName: record.name,
      });

      const result = await sendSwimProgressEmail({
        companyId: currentCompany.id,
        childId: record.id,
        season: currentSeason,
        levelId: levelReportView,
        pdfBase64: pdf.ready ? pdf.base64 : undefined,
        pdfFilename: pdf.ready ? pdf.filename : undefined,
      });
      if (!result.success) {
        toast({ title: "Email not sent", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Progress email sent",
        description: result.pdfAttached
          ? `Sent to ${result.recipient} with skills chart attached.`
          : `Sent to ${result.recipient}${pdf.ready ? "" : ` (chart PDF skipped: ${pdf.reason})`}.`,
      });
    } catch (err) {
      toast({
        title: "Email not sent",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setProgressEmailSendingId(null);
    }
  };

  const handleCsvImport = async (file: File) => {
    if (!currentCompany?.id || importing) return;
    setImporting(true);
    setImportProgress({ phase: "parsing", current: 0, total: 1, message: "Starting import…" });
    try {
      const text = await file.text();
      const result = await importSwimProgramCsv(
        supabase,
        currentCompany.id,
        text,
        currentSeason,
        setImportProgress,
      );
      await reload();
      await loadHistory();

      const importedSeasons =
        result.seasons.length > 0 ? result.seasons.join(", ") : currentSeason;
      const summary: SwimImportResult = {
        fileName: file.name,
        season: importedSeasons,
        finishedAt: new Date().toLocaleString(),
        levels: result.levels,
        bracelets: result.bracelets,
        matched: result.matched,
        unmatched: result.unmatched,
      };
      setLastImport(summary);

      if (result.levels > 0 && result.bracelets === 0) {
        setActiveTab("levels");
      } else if (result.bracelets > 0) {
        setActiveTab("bracelets");
      } else if (result.matched > 0) {
        setActiveTab("history");
      }

      const unmatchedHint =
        result.unmatched.length > 0
          ? ` · ${result.unmatched.length} unmatched${result.unmatched.length <= 3 ? `: ${result.unmatched.join(", ")}` : ` (e.g. ${result.unmatched.slice(0, 3).join(", ")}…)`}`
          : "";
      toast({
        title: "Import complete",
        description: `Saved for season${result.seasons.length === 1 ? "" : "s"} ${importedSeasons}: ${result.levels} level rows, ${result.bracelets} bracelet rows${unmatchedHint}. Check Prior Seasons Report.`,
        duration: 12000,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not save swim records",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const selectedBracelet = braceletData.find((b) => b.id === selectedBraceletId) || null;
  const selectedLevel = levelData.find((l) => l.id === selectedLevelId) || null;

  const swimGroupOptions = useMemo(() => {
    const groups = new Set<string>();
    for (const row of [...braceletData, ...levelData]) {
      if (row.group && row.group !== "—") groups.add(row.group);
    }
    return [...groups].sort((a, b) => a.localeCompare(b));
  }, [braceletData, levelData]);

  const filteredBracelets = useMemo(
    () =>
      braceletData.filter((b) => {
        if (!matchesSwimSearch(b.name, b.group, search)) return false;
        if (braceletGroupFilter !== "all" && b.group !== braceletGroupFilter) return false;
        if (braceletColorFilter !== "all" && b.currentBracelet !== braceletColorFilter) return false;
        if (braceletAssignmentFilter === "assigned" && !b.currentBracelet) return false;
        if (braceletAssignmentFilter === "unassigned" && b.currentBracelet) return false;
        return true;
      }),
    [search, braceletData, braceletGroupFilter, braceletColorFilter, braceletAssignmentFilter],
  );

  const filteredLevels = useMemo(
    () =>
      levelData.filter((r) => {
        if (!matchesSwimSearch(r.name, r.group, search)) return false;
        if (levelGroupFilter !== "all" && r.group !== levelGroupFilter) return false;
        if (levelDataFilter === "has-data" && !levelRecordHasData(r)) return false;
        if (levelDataFilter === "empty" && levelRecordHasData(r)) return false;
        if (levelDataFilter === "imported" && r.lastModified !== "Imported") return false;
        return true;
      }),
    [search, levelData, levelGroupFilter, levelDataFilter],
  );

  const historyTableRows = useMemo(
    () =>
      historyReport.flatMap((row) =>
        row.seasons.map((s) => ({
          key: `${row.personId}-${s.season}`,
          name: row.name,
          season: s.season,
          bracelet: s.bracelet?.currentBracelet || "—",
          goldfish: s.levels?.goldfish ?? [],
          minnow: s.levels?.minnow ?? [],
          tadpole: s.levels?.tadpole ?? [],
        })),
      ),
    [historyReport],
  );

  const historySeasonOptions = useMemo(
    () => [...new Set(historyTableRows.map((r) => r.season))].sort((a, b) => b.localeCompare(a)),
    [historyTableRows],
  );

  const filteredHistoryRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return historyTableRows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.season.includes(q)) return false;
      if (historySeasonFilter !== "all" && r.season !== historySeasonFilter) return false;
      return true;
    });
  }, [historyTableRows, search, historySeasonFilter]);

  const { sorted: sortedBracelets, sort: braceletSort, handleSort: requestBraceletSort } = useSortable(filteredBracelets, {
    key: "name",
    direction: "asc",
  });
  const { sorted: sortedLevels, sort: levelSort, handleSort: requestLevelSort } = useSortable(filteredLevels, {
    key: "name",
    direction: "asc",
  });

  const paginatedBracelets = useMemo(
    () => paginateRows(sortedBracelets, braceletPage, tablePageSize),
    [sortedBracelets, braceletPage, tablePageSize],
  );
  const paginatedLevels = useMemo(
    () => paginateRows(sortedLevels, levelPage, tablePageSize),
    [sortedLevels, levelPage, tablePageSize],
  );
  const paginatedHistory = useMemo(
    () => paginateRows(filteredHistoryRows, historyPage, tablePageSize),
    [filteredHistoryRows, historyPage, tablePageSize],
  );

  useEffect(() => {
    if (braceletPage > paginatedBracelets.totalPages) setBraceletPage(paginatedBracelets.totalPages);
  }, [braceletPage, paginatedBracelets.totalPages]);

  useEffect(() => {
    if (levelPage > paginatedLevels.totalPages) setLevelPage(paginatedLevels.totalPages);
  }, [levelPage, paginatedLevels.totalPages]);

  useEffect(() => {
    if (historyPage > paginatedHistory.totalPages) setHistoryPage(paginatedHistory.totalPages);
  }, [historyPage, paginatedHistory.totalPages]);

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
  const campersWithLevelData = levelData.filter(levelRecordHasData).length;
  const importPercent =
    importProgress && importProgress.total > 0
      ? Math.round((importProgress.current / importProgress.total) * 100)
      : 0;

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
              {loading
                ? "Loading…"
                : `${braceletData.length} active camper${braceletData.length === 1 ? "" : "s"}`}
              {!loading && inactiveHidden > 0 ? ` · ${inactiveHidden} inactive hidden` : ""}
              {!loading ? ` · season ${currentSeason}` : ""}
              {!loading && campersWithLevelData > 0 ? ` · ${campersWithLevelData} with level data` : ""}
              {saving ? " · saving…" : ""}
              {importing ? " · importing…" : ""}
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
          <Button
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => csvInputRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            {importing ? "Importing…" : "Import CSV"}
          </Button>
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

      <Alert className="border-sky-500/30 bg-sky-500/5">
        <AlertTitle className="text-sm">Load prior swim bracelets &amp; levels</AlertTitle>
        <AlertDescription className="text-xs space-y-1.5">
          <p>
            Use <strong>Import CSV</strong> to feed data from Airtable or a spreadsheet. Include a{" "}
            <strong>Season</strong> column (e.g. 2026, 2027), <strong>PersonID</strong> (CampMinder ID), and{" "}
            <strong>current_bracelet</strong> (Red, Orange, Yellow, Green, or Blue).
          </p>
          <p>
            Campers must exist on the roster for that season (or match by PersonID). After import, open{" "}
            <strong>Prior Seasons Report</strong> to review all years. Download <strong>Template</strong> for the
            expected column layout.
          </p>
        </AlertDescription>
      </Alert>

      {importing && importProgress ? (
        <Alert className="border-primary/40 bg-primary/5">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Importing swim data</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{importProgress.message}</p>
            {importProgress.phase === "saving" && importProgress.total > 0 ? (
              <Progress value={importPercent} className="h-2" />
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {lastImport && !importing ? (
        <Alert className="border-emerald-500/40 bg-emerald-500/5 pr-10 relative">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>Last import — season {lastImport.season}</AlertTitle>
          <AlertDescription className="space-y-1">
            <p>
              <span className="font-medium">{lastImport.fileName}</span> at {lastImport.finishedAt}
            </p>
            <p>
              {lastImport.matched} campers matched · {lastImport.levels} level rows · {lastImport.bracelets}{" "}
              bracelet rows
              {lastImport.unmatched.length > 0 ? ` · ${lastImport.unmatched.length} unmatched` : ""}
            </p>
            {lastImport.levels > 0 && lastImport.bracelets === 0 ? (
              <p className="text-muted-foreground">
                This file has swim <strong>levels</strong> only — open the <strong>Swim Level Report</strong> tab to
                review. Bracelet colors need a separate CSV.
              </p>
            ) : null}
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-7 w-7"
            onClick={() => setLastImport(null)}
            aria-label="Dismiss import summary"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ) : null}

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
        <Card className="border-border/50 md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="h-4 w-4 text-sky-400" />
              <span className="text-2xl font-bold">{campersWithLevelData}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">campers with imported / entered levels</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="bracelets">Swim Bracelets</TabsTrigger>
          <TabsTrigger value="levels">Swim Level Report</TabsTrigger>
          <TabsTrigger value="formation">Group Formation</TabsTrigger>
          <TabsTrigger value="history">Prior Seasons Report</TabsTrigger>
        </TabsList>

        <TabsContent value="bracelets" className="mt-4">
          <Card>
            <CardHeader className="pb-3 space-y-3">
              <CardTitle className="text-base">Current bracelet status & test history</CardTitle>
              <div className="flex flex-wrap items-end gap-3">
                <SwimFilterSelect
                  label="Group"
                  value={braceletGroupFilter}
                  onChange={setBraceletGroupFilter}
                  options={[
                    { value: "all", label: "All groups" },
                    ...swimGroupOptions.map((g) => ({ value: g, label: g })),
                  ]}
                />
                <SwimFilterSelect
                  label="Bracelet color"
                  value={braceletColorFilter}
                  onChange={setBraceletColorFilter}
                  options={[
                    { value: "all", label: "All colors" },
                    ...BRACELETS.map((c) => ({ value: c, label: c })),
                  ]}
                />
                <SwimFilterSelect
                  label="Assignment"
                  value={braceletAssignmentFilter}
                  onChange={(v) => setBraceletAssignmentFilter(v as BraceletAssignmentFilter)}
                  options={[
                    { value: "all", label: "All campers" },
                    { value: "assigned", label: "Has bracelet" },
                    { value: "unassigned", label: "No bracelet yet" },
                  ]}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Assign division leader
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={bulkDivisionLeader}
                      onChange={(e) => setBulkDivisionLeader(e.target.value)}
                      className={cn(editableSelect, "min-w-[130px]")}
                    >
                      <option value="">Select leader…</option>
                      {divisionLeaderOptions.map((leader) => (
                        <option key={leader} value={leader}>
                          {leader}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs whitespace-nowrap"
                      disabled={!bulkDivisionLeader || bulkAssigningLeaders || sortedBracelets.length === 0}
                      onClick={() => void assignDivisionLeaderBulk(bulkDivisionLeader, sortedBracelets)}
                    >
                      {bulkAssigningLeaders ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Apply to filtered ({sortedBracelets.length})
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="Name" sortKey="name" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Group" sortKey="group" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Division Leader" sortKey="divisionLeader" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Current Bracelet" sortKey="currentBracelet" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Note Field" sortKey="generalNote" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="1st Proctor" sortKey="proctor1" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="1st Date" sortKey="date1" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="1st Note" sortKey="note1" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="2nd Proctor" sortKey="proctor2" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="2nd Date" sortKey="date2" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="2nd Note" sortKey="note2" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="3rd Proctor" sortKey="proctor3" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="3rd Date" sortKey="date3" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="3rd Note" sortKey="note3" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="4th Proctor" sortKey="proctor4" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="4th Date" sortKey="date4" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="4th Note" sortKey="note4" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="5th Proctor" sortKey="proctor5" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="5th Date" sortKey="date5" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="5th Note" sortKey="note5" currentSort={braceletSort} onSort={requestBraceletSort} />
                    <SortableHeader label="Email" sortKey="emailSent" currentSort={braceletSort} onSort={requestBraceletSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBracelets.rows.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer" onDoubleClick={() => setSelectedBraceletId(b.id)}>
                      <TableCell className="font-medium" onClick={() => setSelectedBraceletId(b.id)}>
                        {b.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => setSelectedBraceletId(b.id)}>
                        {b.group}
                      </TableCell>
                      <TableCell>
                        <DivisionLeaderSelect
                          value={b.divisionLeader}
                          options={divisionLeaderOptions}
                          onChange={(v) => updateBracelet(b.id, { divisionLeader: v || "—" })}
                        />
                      </TableCell>
                      <TableCell>
                        <BraceletSelect value={b.currentBracelet} onChange={(v) => updateBracelet(b.id, { currentBracelet: v })} />
                      </TableCell>
                      <TableCell>
                        <TextEdit
                          value={b.generalNote}
                          placeholder="Note"
                          onChange={(v) => updateBracelet(b.id, { generalNote: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect
                          value={b.proctor1}
                          options={proctorOptions}
                          onChange={(v) => updateBracelet(b.id, { proctor1: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date1} onChange={(v) => updateBracelet(b.id, { date1: v })} />
                      </TableCell>
                      <TableCell>
                        <TestNoteSelect value={b.note1} onChange={(v) => updateBracelet(b.id, { note1: v })} />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect
                          value={b.proctor2}
                          options={proctorOptions}
                          onChange={(v) => updateBracelet(b.id, { proctor2: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date2} onChange={(v) => updateBracelet(b.id, { date2: v })} />
                      </TableCell>
                      <TableCell>
                        <TestNoteSelect value={b.note2} onChange={(v) => updateBracelet(b.id, { note2: v })} />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect
                          value={b.proctor3}
                          options={proctorOptions}
                          onChange={(v) => updateBracelet(b.id, { proctor3: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date3} onChange={(v) => updateBracelet(b.id, { date3: v })} />
                      </TableCell>
                      <TableCell>
                        <TestNoteSelect value={b.note3} onChange={(v) => updateBracelet(b.id, { note3: v })} />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect
                          value={b.proctor4}
                          options={proctorOptions}
                          onChange={(v) => updateBracelet(b.id, { proctor4: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date4} onChange={(v) => updateBracelet(b.id, { date4: v })} />
                      </TableCell>
                      <TableCell>
                        <TestNoteSelect value={b.note4} onChange={(v) => updateBracelet(b.id, { note4: v })} />
                      </TableCell>
                      <TableCell>
                        <ProctorSelect
                          value={b.proctor5}
                          options={proctorOptions}
                          onChange={(v) => updateBracelet(b.id, { proctor5: v })}
                        />
                      </TableCell>
                      <TableCell>
                        <DateEdit value={b.date5} onChange={(v) => updateBracelet(b.id, { date5: v })} />
                      </TableCell>
                      <TableCell>
                        <TestNoteSelect value={b.note5} onChange={(v) => updateBracelet(b.id, { note5: v })} />
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
              <SwimTableFooter
                slice={paginatedBracelets}
                pageSize={tablePageSize}
                onPageChange={setBraceletPage}
                onPageSizeChange={setTablePageSize}
                emptyMessage="No campers match the current search or filters."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="levels" className="mt-4">
          <Card>
            <CardHeader className="pb-3 space-y-3">
              <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
                <span>Skill checklist — A = Achieved, W = Working towards</span>
                <span className="text-xs font-normal text-muted-foreground">Tap A / W / — on each skill</span>
              </CardTitle>
              <div className="flex flex-wrap items-end gap-3">
                <SwimFilterSelect
                  label="View"
                  value={levelReportView}
                  onChange={(v) => setLevelReportView(v as SwimLevelReportView)}
                  options={SWIM_LEVEL_REPORT_VIEWS.map((v) => ({ value: v.value, label: v.label }))}
                />
                <SwimFilterSelect
                  label="Group"
                  value={levelGroupFilter}
                  onChange={setLevelGroupFilter}
                  options={[
                    { value: "all", label: "All groups" },
                    ...swimGroupOptions.map((g) => ({ value: g, label: g })),
                  ]}
                />
                <SwimFilterSelect
                  label="Level data"
                  value={levelDataFilter}
                  onChange={(v) => setLevelDataFilter(v as LevelDataFilter)}
                  options={[
                    { value: "all", label: "All campers" },
                    { value: "has-data", label: "Has level data" },
                    { value: "empty", label: "No level data yet" },
                    { value: "imported", label: "Imported from Airtable" },
                  ]}
                />
              </div>
              {levelReportView !== "all" && swimProgressEmailSupported(levelReportView) ? (
                <p className="text-xs text-muted-foreground">
                  Send Progress Email goes to the parent on file with Achieved / Working Toward skills in the body, plus the
                  NSDC skills chart PDF with green checkmarks on mastered skills.
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="Child's Name" sortKey="name" currentSort={levelSort} onSort={requestLevelSort} />
                    <SortableHeader label="Group" sortKey="group" currentSort={levelSort} onSort={requestLevelSort} />
                    {[1, 2, 3, 4].map(
                      (n) =>
                        swimLevelColumnVisible(levelReportView, `goldfish-${n - 1}`) && (
                          <SortableHeader
                            key={`g${n}`}
                            label={`Goldfish 1A${n}`}
                            sortKey={`goldfish.${n - 1}`}
                            currentSort={levelSort}
                            onSort={requestLevelSort}
                          />
                        ),
                    )}
                    {swimLevelColumnVisible(levelReportView, "goldfishLevel") ? (
                      <SortableHeader label="Goldfish Level" sortKey="goldfishLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {[0, 1].map(
                      (i) =>
                        swimLevelColumnVisible(levelReportView, `exit-${i}`) && (
                          <SortableHeader
                            key={`exit${i}`}
                            label={`Exit ${i + 1}`}
                            sortKey={`exitSkills.${i}`}
                            currentSort={levelSort}
                            onSort={requestLevelSort}
                          />
                        ),
                    )}
                    {[1, 2, 3, 4, 5, 6].map(
                      (n) =>
                        swimLevelColumnVisible(levelReportView, `minnow-${n - 1}`) && (
                          <SortableHeader
                            key={`m${n}`}
                            label={`Minnow 1B${n}`}
                            sortKey={`minnow.${n - 1}`}
                            currentSort={levelSort}
                            onSort={requestLevelSort}
                          />
                        ),
                    )}
                    {swimLevelColumnVisible(levelReportView, "minnowLevel") ? (
                      <SortableHeader label="Minnow Level" sortKey="minnowLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {[1, 2, 3, 4].map(
                      (n) =>
                        swimLevelColumnVisible(levelReportView, `tadpole-${n - 1}`) && (
                          <SortableHeader
                            key={`t${n}`}
                            label={`Tadpole 1C${n}`}
                            sortKey={`tadpole.${n - 1}`}
                            currentSort={levelSort}
                            onSort={requestLevelSort}
                          />
                        ),
                    )}
                    {swimLevelColumnVisible(levelReportView, "tadpoleLevel") ? (
                      <SortableHeader label="Tadpole Level" sortKey="tadpoleLevel" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {swimLevelColumnVisible(levelReportView, "redCross") ? (
                      <SortableHeader label="Red Cross Level 1" sortKey="redCross" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {swimLevelColumnVisible(levelReportView, "redCross2") ? (
                      <SortableHeader label="Red Cross Level 2" sortKey="redCross2" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {swimLevelColumnVisible(levelReportView, "redCross3") ? (
                      <SortableHeader label="Red Cross Level 3" sortKey="redCross3" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {swimLevelColumnVisible(levelReportView, "redCross4") ? (
                      <SortableHeader label="Red Cross Level 4" sortKey="redCross4" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {swimLevelColumnVisible(levelReportView, "frog") ? (
                      <SortableHeader label="Frog Level" sortKey="frog" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {swimLevelColumnVisible(levelReportView, "lastModified") ? (
                      <SortableHeader label="Last Modified" sortKey="lastModified" currentSort={levelSort} onSort={requestLevelSort} />
                    ) : null}
                    {levelReportView !== "all" && swimProgressEmailSupported(levelReportView) ? (
                      <TableCell className="font-semibold whitespace-nowrap">Progress Email</TableCell>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLevels.rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onDoubleClick={() => setSelectedLevelId(r.id)}>
                      <TableCell className="font-medium whitespace-nowrap" onClick={() => setSelectedLevelId(r.id)}>
                        {r.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground" onClick={() => setSelectedLevelId(r.id)}>
                        {r.group}
                      </TableCell>
                      {r.goldfish.map(
                        (s, i) =>
                          swimLevelColumnVisible(levelReportView, `goldfish-${i}`) && (
                            <TableCell key={`g${i}`}>
                              <SkillToggle value={s} onChange={(v) => updateSkill(r.id, "goldfish", i, v)} />
                            </TableCell>
                          ),
                      )}
                      {swimLevelColumnVisible(levelReportView, "goldfishLevel") ? (
                        <TableCell>
                          <LevelSelect value={r.goldfishLevel} onChange={(v) => updateLevel(r.id, { goldfishLevel: v })} />
                        </TableCell>
                      ) : null}
                      {r.exitSkills.map(
                        (s, i) =>
                          swimLevelColumnVisible(levelReportView, `exit-${i}`) && (
                            <TableCell key={`exit${i}`}>
                              <SkillToggle value={s} onChange={(v) => updateSkill(r.id, "exit", i, v)} />
                            </TableCell>
                          ),
                      )}
                      {r.minnow.map(
                        (s, i) =>
                          swimLevelColumnVisible(levelReportView, `minnow-${i}`) && (
                            <TableCell key={`m${i}`}>
                              <SkillToggle value={s} onChange={(v) => updateSkill(r.id, "minnow", i, v)} />
                            </TableCell>
                          ),
                      )}
                      {swimLevelColumnVisible(levelReportView, "minnowLevel") ? (
                        <TableCell>
                          <LevelSelect value={r.minnowLevel} onChange={(v) => updateLevel(r.id, { minnowLevel: v })} />
                        </TableCell>
                      ) : null}
                      {r.tadpole.map(
                        (s, i) =>
                          swimLevelColumnVisible(levelReportView, `tadpole-${i}`) && (
                            <TableCell key={`t${i}`}>
                              <SkillToggle value={s} onChange={(v) => updateSkill(r.id, "tadpole", i, v)} />
                            </TableCell>
                          ),
                      )}
                      {swimLevelColumnVisible(levelReportView, "tadpoleLevel") ? (
                        <TableCell>
                          <LevelSelect value={r.tadpoleLevel} onChange={(v) => updateLevel(r.id, { tadpoleLevel: v })} />
                        </TableCell>
                      ) : null}
                      {swimLevelColumnVisible(levelReportView, "redCross") ? (
                        <TableCell>
                          <LevelSelect value={r.redCross} onChange={(v) => updateLevel(r.id, { redCross: v })} />
                        </TableCell>
                      ) : null}
                      {swimLevelColumnVisible(levelReportView, "redCross2") ? (
                        <TableCell>
                          <LevelSelect value={r.redCross2} onChange={(v) => updateLevel(r.id, { redCross2: v })} />
                        </TableCell>
                      ) : null}
                      {swimLevelColumnVisible(levelReportView, "redCross3") ? (
                        <TableCell>
                          <LevelSelect value={r.redCross3} onChange={(v) => updateLevel(r.id, { redCross3: v })} />
                        </TableCell>
                      ) : null}
                      {swimLevelColumnVisible(levelReportView, "redCross4") ? (
                        <TableCell>
                          <LevelSelect value={r.redCross4} onChange={(v) => updateLevel(r.id, { redCross4: v })} />
                        </TableCell>
                      ) : null}
                      {swimLevelColumnVisible(levelReportView, "frog") ? (
                        <TableCell>
                          <LevelSelect value={r.frog} onChange={(v) => updateLevel(r.id, { frog: v })} />
                        </TableCell>
                      ) : null}
                      {swimLevelColumnVisible(levelReportView, "lastModified") ? (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{r.lastModified}</TableCell>
                      ) : null}
                      {levelReportView !== "all" && swimProgressEmailSupported(levelReportView) ? (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={progressEmailSendingId === r.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSendProgressEmail(r);
                            }}
                          >
                            {progressEmailSendingId === r.id ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3 mr-1" />
                            )}
                            Send
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <SwimTableFooter
                slice={paginatedLevels}
                pageSize={tablePageSize}
                onPageChange={setLevelPage}
                onPageSizeChange={setTablePageSize}
                emptyMessage="No campers match the current search or filters."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formation" className="mt-4">
          {currentCompany?.id ? (
            <SwimGroupFormationPanel companyId={currentCompany.id} season={currentSeason} />
          ) : (
            <Alert>
              <AlertDescription>Select a camp to build swim groups.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3 space-y-3">
              <CardTitle className="text-base">Prior seasons — all campers with saved swim data</CardTitle>
              {historySeasonOptions.length > 0 ? (
                <div className="flex flex-wrap items-end gap-3">
                  <SwimFilterSelect
                    label="Season"
                    value={historySeasonFilter}
                    onChange={setHistorySeasonFilter}
                    options={[
                      { value: "all", label: "All seasons" },
                      ...historySeasonOptions.map((s) => ({ value: s, label: s })),
                    ]}
                  />
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {historyLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading history…</p>
              ) : historyReport.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No prior swim data yet. Import Airtable CSV or enter data on Bracelets / Level Report tabs.
                </p>
              ) : (
                <>
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
                      {paginatedHistory.rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium whitespace-nowrap">{row.name}</TableCell>
                          <TableCell>{row.season}</TableCell>
                          <TableCell>{row.bracelet}</TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {row.goldfish.map((sk, i) => (
                                <SkillCell key={i} status={sk} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {row.minnow.map((sk, i) => (
                                <SkillCell key={i} status={sk} />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {row.tadpole.map((sk, i) => (
                                <SkillCell key={i} status={sk} />
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <SwimTableFooter
                    slice={paginatedHistory}
                    pageSize={tablePageSize}
                    onPageChange={setHistoryPage}
                    onPageSizeChange={setTablePageSize}
                    emptyMessage="No history rows match the current search or filters."
                  />
                </>
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
                <div className="rounded-lg border bg-card/50 p-3">
                  <h4 className="text-sm font-semibold mb-2">Exit Skills</h4>
                  <div className="space-y-2">
                    {selectedLevel.exitSkills.map((s, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 rounded bg-muted/30 px-2 py-1.5 text-xs">
                        <span className="text-muted-foreground leading-snug">
                          Exit {i + 1}
                          {i === 0
                            ? " — Enter independently, bob 5 times, exit safely"
                            : " — Front glide, back float 5 sec, recover"}
                        </span>
                        <SkillCell status={s} />
                      </div>
                    ))}
                  </div>
                </div>
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
