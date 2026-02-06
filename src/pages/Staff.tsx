import { useNavigate } from "react-router-dom";
import { Search, Star, TrendingUp, Pencil, Trash2, ClipboardCheck, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AddStaffDialog from "@/components/dialogs/AddStaffDialog";
import EditStaffDialog from "@/components/dialogs/EditStaffDialog";
import { EvaluateStaffDialog } from "@/components/dialogs/EvaluateStaffDialog";
import { BulkRfidAssignmentDialog } from "@/components/dialogs/BulkRfidAssignmentDialog";
import { BulkLeaderAssignmentDialog } from "@/components/dialogs/BulkLeaderAssignmentDialog";
import CSVUploader from "@/components/CSVUploader";
import { toast } from "sonner";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
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

export default function Staff() {
  const [searchTerm, setSearchTerm] = useState("");
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<string | null>(null);
  const [evaluatingStaff, setEvaluatingStaff] = useState<string | null>(null);
  const [myStaffId, setMyStaffId] = useState<string | null>(null);
  const { currentSeason } = useSeasonContext();
  const { currentCompany } = useCompany();
  const { userRole, isSuperAdmin } = usePermissions();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const isLeaderRole = userRole === 'division_leader' || userRole === 'specialist';
  
  // RFID Scanner state
  const [rfidInput, setRfidInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannerMode, setScannerMode] = useState(false);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  const fetchStaff = async () => {
    setLoading(true);
    setStaffError(null);

    if (!currentCompany?.id) {
      setStaff([]);
      setLoading(false);
      return;
    }

    console.log("[Staff] Fetching staff for company:", currentCompany.id, "season:", currentSeason);

    // NOTE: Avoid PostgREST nested relation joins here.
    // We fetch staff first, then evaluations in a separate query.
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .neq("name", "Unknown")
      .not("name", "is", null)
      .order("name");

    console.log("[Staff] Fetched", staffData?.length || 0, "staff members, error:", staffError);

    if (staffError) {
      console.error("[Staff] Failed to fetch staff:", staffError);
      setStaff([]);
      setStaffError(staffError.message || "Failed to load staff");
      setLoading(false);
      return;
    }

    const staffRows = staffData || [];

    // Fetch evaluations (if any) and map them to staff_id
    const staffIds = staffRows.map((s: any) => s.id).filter(Boolean);
    let evalsByStaffId = new Map<string, any[]>();

    if (staffIds.length > 0) {
      const { data: evalRows, error: evalError } = await supabase
        .from("staff_evaluations")
        .select("staff_id, rating, date, comments")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .in("staff_id", staffIds);

      if (evalError) {
        // Non-fatal: staff can still render.
        console.warn("[Staff] Failed to fetch staff evaluations:", evalError);
      }

      for (const row of evalRows || []) {
        const key = String((row as any).staff_id);
        const existing = evalsByStaffId.get(key) || [];
        existing.push(row);
        evalsByStaffId.set(key, existing);
      }
    }

    const staffWithEvals = staffRows.map((member: any) => {
      const evals = evalsByStaffId.get(String(member.id)) || [];

      // Sort evaluations by date descending
      const sortedEvals = [...evals].sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const averageRating = sortedEvals.length
        ? sortedEvals.reduce((sum: number, e: any) => sum + (Number(e.rating) || 0), 0) /
          sortedEvals.length
        : 0;

      return {
        ...member,
        averageRating: averageRating.toFixed(1),
        evaluationsCount: sortedEvals.length,
        recentEvaluation: sortedEvals[0]?.comments || "No evaluations yet",
        lastEvaluationDate: sortedEvals[0]?.date || null,
      };
    });

    setStaff(staffWithEvals);
    setLoading(false);
  };

  // Track staff IDs assigned to the logged-in leader (many-to-many)
  const [myAssignedStaffIds, setMyAssignedStaffIds] = useState<Set<string>>(new Set());

  // Find the logged-in user's staff record and their assignments
  useEffect(() => {
    const findMyStaffRecord = async () => {
      if (!user?.email || !currentCompany?.id || !isLeaderRole) {
        setMyStaffId(null);
        setMyAssignedStaffIds(new Set());
        return;
      }
      const { data } = await supabase
        .from("staff")
        .select("id")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .ilike("email", user.email)
        .maybeSingle();
      
      const staffId = data?.id || null;
      setMyStaffId(staffId);

      if (staffId) {
        const { data: assignmentData } = await supabase
          .from("staff_leader_assignments")
          .select("staff_id")
          .eq("leader_id", staffId)
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason);
        setMyAssignedStaffIds(new Set((assignmentData || []).map(a => a.staff_id)));
      } else {
        setMyAssignedStaffIds(new Set());
      }
    };
    findMyStaffRecord();
  }, [user?.email, currentCompany?.id, currentSeason, isLeaderRole]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchStaff();
    }
  }, [currentCompany?.id, currentSeason]);

  const filteredStaff = staff.filter((member) => {
    // Leader-based filtering: division_leader/specialist only see their assigned staff (many-to-many)
    if (isLeaderRole && myStaffId) {
      if (member.id !== myStaffId && !myAssignedStaffIds.has(member.id)) {
        return false;
      }
    }

    const matchesSearch = 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.role?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (member.department?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    
    const matchesSession = 
      selectedSession === "all" || 
      member.session === selectedSession || 
      member.session?.includes("First Session") && selectedSession === "First Session" ||
      member.session?.includes("Second Session") && selectedSession === "Second Session" ||
      !member.session;
    
    const matchesGender = 
      selectedGender === "all" ||
      member.gender?.toLowerCase() === selectedGender.toLowerCase();
    
    return matchesSearch && matchesSession && matchesGender;
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete staff member");
      console.error(error);
    } else {
      toast.success("Staff member deleted successfully");
      fetchStaff();
    }
    setDeletingStaff(null);
  };

  // RFID Scanner handlers
  const handleRfidScan = async (rfidValue?: string) => {
    const valueToScan = rfidValue || rfidInput.trim();
    if (!valueToScan) {
      toast.error("Please scan a wristband");
      return;
    }

    console.log('[RFID Staff] Scanning:', valueToScan);
    setIsScanning(true);
    
    try {
      // Find staff by RFID - works for ALL companies
      const { data: staffMember, error } = await supabase
        .from('staff')
        .select('id, name, rfid')
        .eq('rfid', valueToScan)
        .eq('company_id', currentCompany?.id)
        .eq('season', currentSeason)
        .single();

      console.log('[RFID Staff] Result:', { staffMember, error });

      if (error || !staffMember) {
        toast.error("Wristband not assigned to any staff", {
          description: `RFID: ${valueToScan.slice(0, 12)}...`,
          duration: 4000
        });
        setRfidInput("");
        setTimeout(() => rfidInputRef.current?.focus(), 100);
        return;
      }

      toast.success(`Found: ${staffMember.name}`, {
        description: "Opening staff profile..."
      });
      navigate(`/staff/${staffMember.id}`);
      
    } catch (error) {
      console.error('[RFID Staff] Scan error:', error);
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
      setTimeout(() => {
        rfidInputRef.current?.focus();
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Staff & Evaluations</h1>
          <p className="text-muted-foreground">Manage team members and performance reviews</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={scannerMode ? "default" : "outline"}
            onClick={toggleScannerMode}
            className={scannerMode ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Radio className={`h-4 w-4 mr-2 ${scannerMode ? "animate-pulse" : ""}`} />
            {scannerMode ? "Scanner Active" : "Scan Wristband"}
          </Button>
          {(userRole === 'admin' || isSuperAdmin) && (
            <BulkLeaderAssignmentDialog onSuccess={fetchStaff} />
          )}
          <BulkRfidAssignmentDialog type="staff" onSuccess={fetchStaff} />
          <CSVUploader tableName="staff" onUploadComplete={fetchStaff} />
          <AddStaffDialog onSuccess={fetchStaff} />
          <CSVUploader tableName="staff" onUploadComplete={fetchStaff} />
          <AddStaffDialog onSuccess={fetchStaff} />
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
              {isScanning ? "Searching..." : "Find Staff"}
            </Button>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            Bluetooth scanner ready. Scans auto-submit. Tap input if focus is lost.
          </p>
        </div>
      )}

      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff by name, role, or department..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={selectedGender}
          onChange={(e) => setSelectedGender(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
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
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {staffError && (
            <div className="text-sm text-destructive">
              Couldn’t load staff: {staffError}
            </div>
          )}
          {isLeaderRole && myStaffId && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <strong>My Team:</strong> Showing staff assigned to you. Contact an admin to update assignments.
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Showing {filteredStaff.length} of {staff.length} staff members for {currentSeason}
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredStaff.map((staffMember) => (
            <Card
              key={staffMember.id}
              className={`shadow-card hover:shadow-md transition-all group ${
                !staffMember.staff_type ? 'border-2 border-destructive bg-destructive/5' : ''
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => navigate(`/staff/${staffMember.id}`)}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {getInitials(staffMember.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg mb-1">{staffMember.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{staffMember.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEvaluatingStaff(staffMember.id);
                      }}
                      title="Evaluate Staff"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingStaff(staffMember.id);
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
                        setDeletingStaff(staffMember.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {staffMember.department && (
                      <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20">
                        {staffMember.department}
                      </Badge>
                    )}
                    {staffMember.staff_type ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {staffMember.staff_type === "general_counselor" ? "General Counselor" : 
                         staffMember.staff_type === "specialist" ? "Specialist" : 
                         staffMember.staff_type === "support" ? "Support" :
                         staffMember.staff_type === "leadership" ? "Leadership" : "Both"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        No Type Set
                      </Badge>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      staffMember.status === "active"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {staffMember.status || "Active"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-warning/10">
                    <Star className="h-4 w-4 text-warning fill-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{staffMember.averageRating} Average Rating</p>
                    <p className="text-xs text-muted-foreground">{staffMember.evaluationsCount} evaluations</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-success mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Recent Evaluation</p>
                      <p className="text-xs text-muted-foreground">{staffMember.recentEvaluation}</p>
                      {staffMember.lastEvaluationDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(staffMember.lastEvaluationDate).toLocaleDateString('en-US')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}

      {!loading && filteredStaff.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No staff members found matching your search.</p>
        </div>
      )}

      {editingStaff && (
        <EditStaffDialog
          staffId={editingStaff}
          open={!!editingStaff}
          onOpenChange={(open) => !open && setEditingStaff(null)}
          onSuccess={fetchStaff}
        />
      )}

      {evaluatingStaff && (
        <EvaluateStaffDialog
          open={!!evaluatingStaff}
          onOpenChange={(open) => !open && setEvaluatingStaff(null)}
          staffId={evaluatingStaff}
          staffName={staff.find(s => s.id === evaluatingStaff)?.name || ""}
          staffRole={staff.find(s => s.id === evaluatingStaff)?.role || ""}
          staffType={staff.find(s => s.id === evaluatingStaff)?.staff_type || null}
          onSuccess={fetchStaff}
        />
      )}

      <AlertDialog open={!!deletingStaff} onOpenChange={(open) => !open && setDeletingStaff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the staff member record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingStaff && handleDelete(deletingStaff)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
