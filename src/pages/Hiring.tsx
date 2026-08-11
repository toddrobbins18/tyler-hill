import { useEffect, useState } from "react";
import { StaffMember } from "@/types/staff";
import { initialStaffData } from "@/data/hiringStaffData";
import { HiringStats } from "@/components/hiring/HiringStats";
import { KanbanBoard } from "@/components/hiring/KanbanBoard";
import { Input } from "@/components/ui/input";
import { Search, Briefcase } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";

const STORAGE_KEY_PREFIX = "hiring-board-state-v1";

const loadInitial = (storageKey: string): StaffMember[] => {
  if (typeof window === "undefined") return initialStaffData;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialStaffData;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as StaffMember[];
    return initialStaffData;
  } catch {
    return initialStaffData;
  }
};

export default function Hiring() {
  const { currentCompany } = useCompany();
  const storageKey = `${STORAGE_KEY_PREFIX}-${currentCompany?.id ?? "default"}`;
  const [staff, setStaff] = useState<StaffMember[]>(() => loadInitial(storageKey));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setStaff(loadInitial(storageKey));
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(staff));
    } catch {
      // ignore quota errors
    }
  }, [staff, storageKey]);

  const filteredStaff = staff.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Briefcase className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Hiring 2026</h1>
            <p className="text-sm text-muted-foreground">Hiring pipeline & budget management</p>
          </div>
        </div>

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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <aside className="xl:col-span-1">
          <HiringStats staff={staff} />
        </aside>

        <section className="xl:col-span-3">
          <div className="mb-4">
            <h2 className="text-base font-semibold mb-1">Hiring Pipeline</h2>
            <p className="text-xs text-muted-foreground">
              Drag and drop staff cards to update their hiring status
            </p>
          </div>
          <KanbanBoard staff={filteredStaff} onStaffUpdate={setStaff} />
        </section>
      </div>
    </div>
  );
}
