import { useState, useEffect, useRef } from "react";
import { Search, Filter, Pencil, Trash2, ArrowUpDown, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AddChildDialog from "@/components/dialogs/AddChildDialog";
import EditChildDialog from "@/components/dialogs/EditChildDialog";
import { BulkRfidAssignmentDialog } from "@/components/dialogs/BulkRfidAssignmentDialog";
import CSVUploader from "@/components/CSVUploader";
import { toast } from "sonner";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { usePermissions } from "@/hooks/usePermissions";
import { lookupChildByRfid, normalizeRfidInput } from "@/lib/rfidUtils";
import { useCompany } from "@/contexts/CompanyContext";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";
import {
  camperMatchesDivisionFilter,
  getDivisionDropdownLabel,
  normalizeDivisionNameForFilter,
} from "@/lib/divisionFilterUtils";
import { compareByLastName } from "@/lib/nameSortUtils";
import { isDayCampCompany } from "@/lib/camps";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function Roster() {
  const { currentSeason } = useSeasonContext();
  const { currentCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [children, setChildren] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "division" | "group">("name");
  const isDayCamp = isDayCampCompany(currentCompany);
  const [loading, setLoading] = useState(true);
  const [editingChild, setEditingChild] = useState<string | null>(null);
  const [deletingChild, setDeletingChild] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const navigate = useNavigate();
  
  // RFID Scanner state
  const [rfidInput, setRfidInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannerMode, setScannerMode] = useState(false);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  const { loading: permissionsLoading, userDivisionsKey } = usePermissions();

  const CAMPERS_PAGE_SIZE = 1000;

  const fetchChildren = async () => {
    setLoading(true);
    
    if (!currentCompany?.id) {
      setChildren([]);
      setLoading(false);
      return;
    }
    
    // Division leaders/viewers: RLS (get_user_divisions) scopes rows — do not add a second
    // division_id filter here; client-side alias expansion can drift from DB permissions.
    const rows: any[] = [];
    let from = 0;

    try {
      for (;;) {
        const to = from + CAMPERS_PAGE_SIZE - 1;
        let query = supabase
          .from("children")
          .select(`
            id, name, grade, status, session, season, division_id, person_id, group_name,
            division:division_id(id, name, gender, sort_order),
            leader:leader_id(id, name),
            bunk:bunk_id(id, bunk_number, bunk_name)
          `)
          .eq('company_id', currentCompany.id)
          .eq('season', currentSeason);

        const { data, error } = await query
          .neq('status', 'inactive')
          .order("name")
          .range(from, to);

        if (error) {
          console.error('Roster fetch error:', error);
          toast.error('Failed to load campers');
          break;
        }

        const batch = data || [];
        rows.push(...batch);
        if (batch.length < CAMPERS_PAGE_SIZE) break;
        from += CAMPERS_PAGE_SIZE;
      }

      // Ensure roster list is sorted by last name
      rows.sort(compareByLastName);

      setChildren(rows);
    } catch (err) {
      console.error('Roster fetch error:', err);
      toast.error('Failed to load campers');
    }
    
    setLoading(false);
  };

  const fetchDivisions = async () => {
    if (!currentCompany?.id) {
      setDivisions([]);
      return;
    }
    
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .eq('company_id', currentCompany.id)
      .eq('is_active', true);
    
    if (data) {
      setDivisions(sortDivisionsAlternatingGender(data));
    }
  };

  useEffect(() => {
    // Wait for permissions to load before fetching children
    // This ensures division_leader users have their divisions populated
    if (currentCompany?.id && !permissionsLoading) {
      fetchChildren();
      fetchDivisions();
    }
  }, [currentSeason, currentCompany?.id, permissionsLoading, userDivisionsKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDivision, selectedSession, currentSeason, sortBy]);

  const selectedDivisionRecord = divisions.find((div) => div.id === selectedDivision);

  const filteredChildren = children
    .filter((child) => {
      const matchesSearch = 
        child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (child.grade?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (child.division?.name?.toLowerCase() || "").includes(searchTerm.toLowerCase());
      
      const matchesDivision = camperMatchesDivisionFilter(
        child.division_id,
        child.division?.name,
        selectedDivision,
        selectedDivisionRecord?.name,
      );
      
      const matchesSession = 
        selectedSession === "all" || 
        child.session === selectedSession || 
        (selectedSession === "First Session" && child.session?.includes("First Session")) ||
        (selectedSession === "Second Session" && child.session?.includes("Second Session")) ||
        !child.session;
      
      const matchesSeason = 
        child.season === currentSeason;
      
      return matchesSearch && matchesDivision && matchesSession && matchesSeason;
    })
    .sort((a, b) => {
      if (sortBy === "group") {
        const groupA = (a.group_name || "").trim().toLowerCase();
        const groupB = (b.group_name || "").trim().toLowerCase();
        if (groupA !== groupB) {
          if (!groupA) return 1;
          if (!groupB) return -1;
          return groupA.localeCompare(groupB);
        }
        return compareByLastName(a, b);
      }
      if (sortBy === "division") {
        const divA = a.division?.sort_order || 999;
        const divB = b.division?.sort_order || 999;
        if (divA !== divB) return divA - divB;
        const nameA = normalizeDivisionNameForFilter(a.division?.name);
        const nameB = normalizeDivisionNameForFilter(b.division?.name);
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return compareByLastName(a, b);
      }
      return compareByLastName(a, b);
    });

  const cycleSortBy = () => {
    if (isDayCamp) {
      setSortBy((prev) =>
        prev === "name" ? "division" : prev === "division" ? "group" : "name",
      );
      return;
    }
    setSortBy((prev) => (prev === "name" ? "division" : "name"));
  };

  const sortByLabel =
    sortBy === "name" ? "Name" : sortBy === "division" ? "Division" : "Group";

  const totalPages = Math.ceil(filteredChildren.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChildren = filteredChildren.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('ellipsis-start');
      }
      
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("children")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete child");
      console.error(error);
    } else {
      toast.success("Child deleted successfully");
      fetchChildren();
    }
    setDeletingChild(null);
  };

  // RFID Scanner handlers
  const handleRfidScan = async (rfidValue?: string) => {
    const valueToScan = normalizeRfidInput(rfidValue || rfidInput);
    if (!valueToScan) {
      toast.error("Please scan a wristband");
      return;
    }

    if (!currentCompany?.id) {
      toast.error("No camp selected");
      return;
    }

    console.log('[RFID] Scanning:', valueToScan);
    setIsScanning(true);
    
    try {
      const child = await lookupChildByRfid(valueToScan, currentCompany.id, currentSeason);

      console.log('[RFID] Result:', { child });

      if (!child) {
        toast.error("Wristband not assigned to any camper", {
          description: `RFID: ${valueToScan.slice(0, 12)}...`,
          duration: 4000
        });
        setRfidInput("");
        // Re-focus for next scan
        setTimeout(() => rfidInputRef.current?.focus(), 100);
        return;
      }

      toast.success(`Found: ${child.name}`, {
        description: "Opening camper profile..."
      });
      navigate(`/child/${child.id}`);
      
    } catch (error) {
      console.error('[RFID] Scan error:', error);
      toast.error("Scan error occurred");
    } finally {
      setIsScanning(false);
      setRfidInput("");
    }
  };

  // Match Nurse page exactly - no preventDefault, direct handler
  const handleRfidKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRfidScan();
    }
  };

  const toggleScannerMode = () => {
    const newMode = !scannerMode;
    setScannerMode(newMode);
    if (newMode) {
      // Focus the input when enabling scanner mode
      setTimeout(() => {
        rfidInputRef.current?.focus();
        // On mobile, also try to select to ensure cursor is ready
        rfidInputRef.current?.select();
      }, 150);
    }
  };

  // Keep scanner input focused when in scanner mode
  useEffect(() => {
    if (scannerMode) {
      const interval = setInterval(() => {
        if (document.activeElement !== rfidInputRef.current && !isScanning) {
          rfidInputRef.current?.focus();
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [scannerMode, isScanning]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Camper</h1>
          <p className="text-muted-foreground">Manage and view all campers in your program</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={scannerMode ? "default" : "outline"}
            onClick={toggleScannerMode}
            className={scannerMode ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Radio className={`h-4 w-4 mr-2 ${scannerMode ? "animate-pulse" : ""}`} />
            {scannerMode ? "Scanner Active" : "Scan Wristband"}
          </Button>
          <BulkRfidAssignmentDialog type="children" onSuccess={fetchChildren} />
          <CSVUploader tableName="children" onUploadComplete={fetchChildren} />
          <AddChildDialog onSuccess={fetchChildren} />
        </div>
      </div>

      {/* RFID Scanner Input */}
      {scannerMode && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-green-800 dark:text-green-200 mb-1 block">
                Ready to scan wristband (ISO 14443 Type A)
              </label>
              <Input
                ref={rfidInputRef}
                value={rfidInput}
                onChange={(e) => setRfidInput(e.target.value)}
                onKeyPress={handleRfidKeyPress}
                placeholder="Scan wristband or enter RFID..."
                className="bg-white dark:bg-background border-green-300 dark:border-green-700 focus:ring-green-500 text-lg"
                autoFocus
                disabled={isScanning}
              />
            </div>
            <Button 
              onClick={() => handleRfidScan()} 
              disabled={isScanning || !rfidInput.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isScanning ? "Searching..." : "Find Camper"}
            </Button>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            Bluetooth scanner ready. Scans auto-submit. Tap input if focus is lost.
          </p>
        </div>
      )}

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, grade, or division..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="all">All Divisions</option>
          {divisions.map((div) => (
            <option key={div.id} value={div.id}>
              {getDivisionDropdownLabel(div.name)}
            </option>
          ))}
        </select>
        {currentCompany?.slug === 'timber-lake-west' && (
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            <option value="all">All Sessions</option>
            <option value="First Session">First Session</option>
            <option value="Second Session">Second Session</option>
          </select>
        )}
        <Button
          variant="outline"
          onClick={cycleSortBy}
        >
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Sort by {sortByLabel}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
            <span>
              Showing {filteredChildren.length === 0 ? 0 : startIndex + 1}-{Math.min(endIndex, filteredChildren.length)} of {filteredChildren.length} campers
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedChildren.map((child) => (
            <Card 
              key={child.id} 
              className="shadow-card hover:shadow-md transition-all group"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="space-y-1 flex-1 cursor-pointer"
                    onClick={() => navigate(`/child/${child.id}`)}
                  >
                    <h3 className="font-semibold text-lg">{child.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {child.grade || "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChild(child.id);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingChild(child.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div
                  className="flex items-start justify-between gap-3 text-sm cursor-pointer"
                  onClick={() => navigate(`/child/${child.id}`)}
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-muted-foreground">Division: {getDivisionDropdownLabel(child.division?.name) || "N/A"}</p>
                    {child.bunk && (
                      <p className="text-muted-foreground">Bunk: {child.bunk.bunk_name || `Bunk ${child.bunk.bunk_number}`}</p>
                    )}
                    {child.group_name && (
                      <p className="text-muted-foreground">Team: {child.group_name}</p>
                    )}
                    {child.leader?.name && (
                      <p className="text-muted-foreground">Leader: {child.leader.name}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      child.status === "active"
                        ? "bg-success/10 text-success border-success/20 shrink-0"
                        : "bg-muted text-muted-foreground shrink-0"
                    }
                  >
                    {child.status || "Active"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalPages > 1 && (
          <Pagination className="mt-8">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {getPageNumbers().map((page, idx) => (
                <PaginationItem key={`${page}-${idx}`}>
                  {typeof page === 'number' ? (
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  ) : (
                    <PaginationEllipsis />
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
        </>
      )}

      {!loading && filteredChildren.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No campers found</p>
        </div>
      )}

      {editingChild && (
        <EditChildDialog
          childId={editingChild}
          open={!!editingChild}
          onOpenChange={(open) => !open && setEditingChild(null)}
          onSuccess={fetchChildren}
        />
      )}

      <AlertDialog open={!!deletingChild} onOpenChange={(open) => !open && setDeletingChild(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the camper record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingChild && handleDelete(deletingChild)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
