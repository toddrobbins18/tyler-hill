import { useCallback, useEffect, useState } from "react";
import { StaffMember } from "@/types/staff";
import { HiringStats } from "@/components/hiring/HiringStats";
import { KanbanBoard } from "@/components/hiring/KanbanBoard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, RefreshCw, Trash2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import {
  fetchHiredStaffForHiring,
  mergeHiringPipelineWithSaved,
} from "@/lib/hiringRoster";
import { toast } from "sonner";

const STORAGE_KEY_PREFIX = "hiring-board-state-v2";

function readSavedPipeline(storageKey: string): StaffMember[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StaffMember[]) : null;
  } catch {
    return null;
  }
}

export default function Hiring() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const storageKey = `${STORAGE_KEY_PREFIX}-${currentCompany?.id ?? "default"}-${currentSeason}`;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [rosterCount, setRosterCount] = useState<number | null>(null);

  const loadFromRoster = useCallback(
    async (options?: { clearSaved?: boolean }) => {
      if (!currentCompany?.id) {
        setStaff([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const roster = await fetchHiredStaffForHiring(currentCompany.id, currentSeason);
        const saved = options?.clearSaved ? null : readSavedPipeline(storageKey);
        const merged = mergeHiringPipelineWithSaved(roster, saved);
        setStaff(merged);
        setRosterCount(roster.length);
        if (options?.clearSaved) {
          localStorage.removeItem(storageKey);
          toast.success(`Cleared saved board — loaded ${roster.length} hired staff for ${currentSeason}.`);
        } else if (roster.length === 0) {
          toast.message(`No hired staff found for ${currentSeason}.`);
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Could not load staff roster: ${message}`);
        setStaff([]);
        setRosterCount(null);
      } finally {
        setLoading(false);
      }
    },
    [currentCompany?.id, currentSeason, storageKey],
  );

  useEffect(() => {
    void loadFromRoster();
  }, [loadFromRoster]);

  useEffect(() => {
    if (!staff.length) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(staff));
    } catch {
      // ignore quota errors
    }
  }, [staff, storageKey]);

  const handleClearAndReload = () => {
    void loadFromRoster({ clearSaved: true });
  };

  const filteredStaff = staff.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.department.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Briefcase className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Hiring {currentSeason}</h1>
            <p className="text-sm text-muted-foreground">
              Hired staff from {currentSeason} roster
              {rosterCount != null ? ` · ${rosterCount} on roster` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search staff, positions, departments..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => void loadFromRoster()}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Reload from Roster
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={handleClearAndReload}
          >
            <Trash2 className="h-4 w-4" />
            Clear saved board
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <aside className="xl:col-span-1">
          <HiringStats staff={staff} />
        </aside>

        <section className="xl:col-span-3">
          <div className="mb-4">
            <h2 className="text-base font-semibold mb-1">Hiring Pipeline</h2>
            <p className="text-xs text-muted-foreground">
              Staff load from Nest roster (active/hired for this season). Drag cards to track pipeline status; budgets can be edited on cards.
            </p>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading staff roster…</p>
          ) : staff.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hired staff for {currentSeason}. Run CampMinder staff sync, then click Reload from Roster.
            </p>
          ) : (
            <KanbanBoard staff={filteredStaff} onStaffUpdate={setStaff} />
          )}
        </section>
      </div>
    </div>
  );
}
