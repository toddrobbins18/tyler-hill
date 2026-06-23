import { useState, useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, AlertTriangle, Search, ArrowLeftRight, ChevronLeft, ChevronRight, Radio, Settings, Clock, AlertCircle, Moon, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  buildNightOffScheduleDateRange,
  formatNightOffScheduleLabel,
  mergeNightOffScheduleEntries,
  type NightOffScheduleEntry,
  staffIsScheduledOff,
  shouldRemoveDayOffRecord,
} from "@/lib/odNightOffSchedule";
import { cn } from "@/lib/utils";
import BunkManagement from "@/components/admin/BunkManagement";
import StaffDaysOffCSVUploader from "@/components/admin/StaffDaysOffCSVUploader";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface Staff {
  id: string;
  name: string;
  department: string | null;
  role: string;
  rfid: string | null;
  gender: string | null;
}

interface Bunk {
  id: string;
  bunk_number: number;
  bunk_name: string | null;
  division_id: string | null;
  divisions?: {
    id: string;
    name: string;
    gender: string;
  };
}

interface BunkStaff {
  id: string;
  bunk_id: string;
  staff_id: string;
  is_primary: boolean;
  staff?: Staff;
  bunk?: Bunk;
}

interface DayOff {
  id: string;
  staff_id: string;
  date: string;
  is_day_off: boolean;
  is_night_off: boolean;
  is_sleeping_out: boolean;
  checked_out: boolean;
  checked_in: boolean;
  checked_out_at: string | null;
  checked_in_at: string | null;
  checked_out_by: string | null;
  checked_in_by: string | null;
  checked_out_by_profile?: { full_name: string } | null;
  checked_in_by_profile?: { full_name: string } | null;
  notes: string | null;
  late_override: boolean;
  late_override_reason: string | null;
  late_override_approved_by: string | null;
  late_override_approved_at: string | null;
  staff?: Staff;
}

export default function ODManagement() {
  const { currentCompany } = useCompany();
  const { selectedSeason: currentSeason } = useSeason();
  const { toast } = useToast();
  const { user } = useAuth();
  const { userRole } = usePermissions();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("od");
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [bunks, setBunks] = useState<Bunk[]>([]);
  const [bunkStaff, setBunkStaff] = useState<BunkStaff[]>([]);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [uncoveredBunks, setUncoveredBunks] = useState<Bunk[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [selectedStaffForSwap, setSelectedStaffForSwap] = useState<string | null>(null);
  const [newSwapDate, setNewSwapDate] = useState<Date | undefined>(undefined);
  const [showBunkManagement, setShowBunkManagement] = useState(false);
  const [showScheduleUpload, setShowScheduleUpload] = useState(false);
  
  // Filters
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [signInStatusFilter, setSignInStatusFilter] = useState<string>("all");

  // RFID Scanner state
  const [scannerMode, setScannerMode] = useState(false);
  const [rfidInput, setRfidInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const rfidInputRef = useRef<HTMLInputElement>(null);

  // Late override state
  const [showLateOverrideDialog, setShowLateOverrideDialog] = useState(false);
  const [lateOverrideStaffId, setLateOverrideStaffId] = useState<string | null>(null);
  const [lateOverrideReason, setLateOverrideReason] = useState("");

  const [showManageNightsDialog, setShowManageNightsDialog] = useState(false);
  const [manageNightsStaffId, setManageNightsStaffId] = useState<string | null>(null);
  const [manageNightsStaffName, setManageNightsStaffName] = useState("");
  const [nightOffSchedule, setNightOffSchedule] = useState<NightOffScheduleEntry[]>([]);
  const [loadingNightSchedule, setLoadingNightSchedule] = useState(false);
  const [savingNightDate, setSavingNightDate] = useState<string | null>(null);

  // OD Management is available globally for all camps

  useEffect(() => {
    if (currentCompany?.id) {
      fetchData();
    }
  }, [currentCompany?.id, currentSeason, selectedDate]);

  useEffect(() => {
    // Calculate uncovered bunks when days off change
    checkUncoveredBunks();
  }, [daysOff, bunkStaff, bunks]);

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

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Fetch staff, bunks, bunk_staff, and days_off in parallel
      const [staffRes, bunksRes, bunkStaffRes, daysOffRes] = await Promise.all([
        supabase
          .from("staff")
          .select("id, name, department, role, rfid, gender")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .neq("status", "inactive")
          .order("name"),
        supabase
          .from("bunks")
          .select("id, bunk_number, bunk_name, division_id, divisions:division_id(id, name, gender)")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .eq("is_active", true)
          .order("bunk_number"),
        supabase
          .from("bunk_staff")
          .select(`
            id, bunk_id, staff_id, is_primary,
            staff:staff_id(id, name, department, role, rfid, gender),
            bunk:bunk_id(id, bunk_number, bunk_name, division_id, divisions:division_id(id, name, gender))
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason),
        supabase
          .from("staff_days_off")
          .select(`
            id, staff_id, date, is_day_off, is_night_off, is_sleeping_out, 
            checked_out, checked_in, checked_out_at, checked_in_at, 
            checked_out_by, checked_in_by, notes,
            late_override, late_override_reason, late_override_approved_by, late_override_approved_at,
            staff:staff_id(id, name, department, role, rfid, gender),
            checked_out_by_profile:checked_out_by(full_name),
            checked_in_by_profile:checked_in_by(full_name)
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .eq("date", dateStr)
      ]);

      if (staffRes.data) setStaff(staffRes.data);
      if (bunksRes.data) setBunks(bunksRes.data as unknown as Bunk[]);
      if (bunkStaffRes.data) setBunkStaff(bunkStaffRes.data as unknown as BunkStaff[]);
      if (daysOffRes.data) setDaysOff(daysOffRes.data as unknown as DayOff[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkUncoveredBunks = () => {
    // Find bunks where all assigned staff are off
    const staffOffIds = daysOff
      .filter(d => d.is_day_off || d.is_night_off)
      .map(d => d.staff_id);

    const uncovered = bunks.filter(bunk => {
      const assignedStaff = bunkStaff.filter(bs => bs.bunk_id === bunk.id);
      if (assignedStaff.length === 0) return true; // No staff assigned
      return assignedStaff.every(bs => staffOffIds.includes(bs.staff_id));
    });

    setUncoveredBunks(uncovered);
  };

  const getStaffWithBunk = () => {
    return bunkStaff.map(bs => {
      const staffMember = staff.find(s => s.id === bs.staff_id);
      const bunk = bunks.find(b => b.id === bs.bunk_id);
      const dayOff = daysOff.find(d => d.staff_id === bs.staff_id);
      
      return {
        ...bs,
        staff: staffMember,
        bunk,
        dayOff
      };
    }).filter(item => item.staff && item.bunk)
      .sort((a, b) => (a.bunk?.bunk_number || 0) - (b.bunk?.bunk_number || 0));
  };

  // Get bunk gender from division
  const getBunkGender = (bunk: Bunk | undefined): string | null => {
    if (!bunk) return null;
    return (bunk as any).divisions?.gender || null;
  };

  // RFID Scanner handler
  const handleRfidScan = async (rfidValue?: string) => {
    const valueToScan = rfidValue || rfidInput.trim();
    if (!valueToScan) {
      toast({ title: "Please scan a wristband", variant: "destructive" });
      return;
    }

    setIsScanning(true);

    try {
      // Find staff by RFID
      const { data: staffMember, error } = await supabase
        .from('staff')
        .select('id, name, rfid')
        .eq('rfid', valueToScan)
        .eq('company_id', currentCompany?.id)
        .eq('season', currentSeason)
        .single();

      if (error || !staffMember) {
        toast({
          title: "Wristband not recognized",
          description: `RFID: ${valueToScan.slice(0, 12)}...`,
          variant: "destructive"
        });
        setRfidInput("");
        setTimeout(() => rfidInputRef.current?.focus(), 100);
        return;
      }

      // Check if staff has a day off record for today
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const existingDayOff = daysOff.find(d => d.staff_id === staffMember.id);

      if (!existingDayOff || !staffIsScheduledOff(existingDayOff)) {
        // Staff is not scheduled off - prompt for late override
        setLateOverrideStaffId(staffMember.id);
        setShowLateOverrideDialog(true);
        setRfidInput("");
        setTimeout(() => rfidInputRef.current?.focus(), 100);
        return;
      }

      // Determine action: check out or check in
      if (!existingDayOff.checked_out) {
        // Check OUT
        const { error: updateError } = await supabase
          .from("staff_days_off")
          .update({ 
            checked_out: true, 
            checked_out_at: new Date().toISOString() 
          })
          .eq("id", existingDayOff.id);

        if (updateError) throw updateError;

        toast({
          title: "✓ Checked Out",
          description: `${staffMember.name} signed out at ${format(new Date(), "h:mm a")}`,
        });
      } else if (!existingDayOff.checked_in) {
        // Check IN
        const { error: updateError } = await supabase
          .from("staff_days_off")
          .update({ 
            checked_in: true, 
            checked_in_at: new Date().toISOString() 
          })
          .eq("id", existingDayOff.id);

        if (updateError) throw updateError;

        toast({
          title: "✓ Checked In",
          description: `${staffMember.name} signed in at ${format(new Date(), "h:mm a")}`,
        });
      } else {
        toast({
          title: "Already Completed",
          description: `${staffMember.name} has already checked out and back in today.`,
        });
      }

      await fetchData();
      setRfidInput("");
      setTimeout(() => rfidInputRef.current?.focus(), 100);

    } catch (error) {
      console.error("RFID scan error:", error);
      toast({ title: "Scan error occurred", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

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

  const handleLateOverrideSubmit = async () => {
    if (!lateOverrideStaffId || !currentCompany?.id || !lateOverrideReason.trim()) {
      toast({ title: "Please provide an override reason", variant: "destructive" });
      return;
    }

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    try {
      // Create a new day off record with late override
      const { error } = await supabase
        .from("staff_days_off")
        .insert({
          company_id: currentCompany.id,
          staff_id: lateOverrideStaffId,
          date: dateStr,
          season: currentSeason,
          is_day_off: true,
          is_night_off: false,
          checked_out: true,
          checked_out_at: new Date().toISOString(),
          late_override: true,
          late_override_reason: lateOverrideReason,
          late_override_approved_by: user?.id,
          late_override_approved_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({ 
        title: "Late Override Approved", 
        description: `Staff signed out with override`
      });

      setShowLateOverrideDialog(false);
      setLateOverrideStaffId(null);
      setLateOverrideReason("");
      await fetchData();
    } catch (error) {
      console.error("Late override error:", error);
      toast({ title: "Failed to apply late override", variant: "destructive" });
    }
  };

  const handleToggleDayOff = async (staffId: string, field: 'is_day_off' | 'is_night_off' | 'is_sleeping_out') => {
    if (!currentCompany?.id) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const existing = daysOff.find(d => d.staff_id === staffId);

    try {
      if (existing) {
        const newValue = !existing[field];
        const updates: Partial<DayOff> = { [field]: newValue };

        const { error } = await supabase
          .from("staff_days_off")
          .update(updates)
          .eq("id", existing.id);

        if (error) throw error;

        if (
          shouldRemoveDayOffRecord({
            ...existing,
            ...updates,
          } as DayOff)
        ) {
          await supabase.from("staff_days_off").delete().eq("id", existing.id);
        }
      } else {
        const newRecord = {
          company_id: currentCompany.id,
          staff_id: staffId,
          date: dateStr,
          season: currentSeason,
          is_day_off: field === 'is_day_off',
          is_night_off: field === 'is_night_off',
          is_sleeping_out: field === 'is_sleeping_out'
        };

        const { error } = await supabase
          .from("staff_days_off")
          .insert(newRecord);

        if (error) throw error;
      }

      await fetchData();
      toast({ title: "Updated successfully" });
    } catch (error) {
      console.error("Error updating day off:", error);
      toast({ title: "Error updating", variant: "destructive" });
    }
  };

  const loadNightOffSchedule = async (staffId: string) => {
    if (!currentCompany?.id) return;
    setLoadingNightSchedule(true);
    try {
      const rangeDates = buildNightOffScheduleDateRange(selectedDate);
      const startDate = rangeDates[0];
      const endDate = rangeDates[rangeDates.length - 1];
      const { data, error } = await supabase
        .from("staff_days_off")
        .select("id, date, is_day_off, is_night_off, is_sleeping_out, checked_out, checked_in")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .eq("staff_id", staffId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) throw error;
      setNightOffSchedule(mergeNightOffScheduleEntries(rangeDates, (data || []) as DayOff[]));
    } catch (error) {
      console.error("Error loading night off schedule:", error);
      toast({ title: "Error loading night schedule", variant: "destructive" });
    } finally {
      setLoadingNightSchedule(false);
    }
  };

  const openManageNights = (staffId: string, staffName: string) => {
    setManageNightsStaffId(staffId);
    setManageNightsStaffName(staffName);
    setShowManageNightsDialog(true);
    void loadNightOffSchedule(staffId);
  };

  const handleSetNightOffForDate = async (staffId: string, dateYmd: string, enabled: boolean) => {
    if (!currentCompany?.id) return;
    setSavingNightDate(dateYmd);
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("staff_days_off")
        .select("id, is_day_off, is_night_off, is_sleeping_out, checked_out, checked_in")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .eq("staff_id", staffId)
        .eq("date", dateYmd)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (enabled) {
        if (existing) {
          const { error } = await supabase
            .from("staff_days_off")
            .update({ is_night_off: true })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("staff_days_off").insert({
            company_id: currentCompany.id,
            staff_id: staffId,
            date: dateYmd,
            season: currentSeason,
            is_day_off: false,
            is_night_off: true,
            is_sleeping_out: false,
          });
          if (error) throw error;
        }
      } else if (existing) {
        const nextRecord = { ...existing, is_night_off: false };
        if (shouldRemoveDayOffRecord(nextRecord as DayOff)) {
          const { error } = await supabase.from("staff_days_off").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("staff_days_off")
            .update({ is_night_off: false })
            .eq("id", existing.id);
          if (error) throw error;
        }
      }

      await loadNightOffSchedule(staffId);
      if (dateYmd === format(selectedDate, "yyyy-MM-dd")) {
        await fetchData();
      }
      toast({ title: enabled ? "Night off added" : "Night off removed" });
    } catch (error) {
      console.error("Error updating night off:", error);
      toast({ title: "Error updating night off", variant: "destructive" });
    } finally {
      setSavingNightDate(null);
    }
  };

  const handleCheckInOut = async (staffId: string, type: 'out' | 'in') => {
    if (!currentCompany?.id || !user?.id) return;

    // Permission check: only admin, staff, and health_center can manually check in/out
    const allowedRoles = ['admin', 'super_admin', 'staff', 'health_center'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      toast({ 
        title: "Permission denied", 
        description: "You don't have permission to manually check staff in/out",
        variant: "destructive" 
      });
      return;
    }

    const existing = daysOff.find(d => d.staff_id === staffId);

    if (!existing) {
      // Prompt for late override if trying to sign out without being scheduled off
      if (type === 'out') {
        setLateOverrideStaffId(staffId);
        setShowLateOverrideDialog(true);
        return;
      }
      toast({ title: "Please set day off first", variant: "destructive" });
      return;
    }

    // Check if signing out on wrong day
    if (type === 'out' && !staffIsScheduledOff(existing)) {
      setLateOverrideStaffId(staffId);
      setShowLateOverrideDialog(true);
      return;
    }

    try {
      const updates = type === 'out' 
        ? { checked_out: true, checked_out_at: new Date().toISOString(), checked_out_by: user.id }
        : { checked_in: true, checked_in_at: new Date().toISOString(), checked_in_by: user.id };

      const { error } = await supabase
        .from("staff_days_off")
        .update(updates)
        .eq("id", existing.id);

      if (error) throw error;
      
      await fetchData();
      toast({ title: `Checked ${type} successfully` });
    } catch (error) {
      console.error("Error checking in/out:", error);
      toast({ title: "Error updating", variant: "destructive" });
    }
  };

  const handleSwapDayOff = async () => {
    if (!selectedStaffForSwap || !newSwapDate || !currentCompany?.id) return;

    const oldDateStr = format(selectedDate, "yyyy-MM-dd");
    const newDateStr = format(newSwapDate, "yyyy-MM-dd");

    try {
      // Remove old day off
      await supabase
        .from("staff_days_off")
        .delete()
        .eq("staff_id", selectedStaffForSwap)
        .eq("date", oldDateStr)
        .eq("company_id", currentCompany.id);

      // Create new day off
      await supabase
        .from("staff_days_off")
        .upsert({
          company_id: currentCompany.id,
          staff_id: selectedStaffForSwap,
          date: newDateStr,
          season: currentSeason,
          is_day_off: true,
          is_night_off: false
        });

      setShowSwapDialog(false);
      setSelectedStaffForSwap(null);
      setNewSwapDate(undefined);
      await fetchData();
      toast({ title: "Day off switched successfully" });
    } catch (error) {
      console.error("Error swapping day off:", error);
      toast({ title: "Error switching day off", variant: "destructive" });
    }
  };

  // Filter staff with bunk based on gender and search
  const filteredStaffWithBunk = getStaffWithBunk().filter(item => {
    const matchesSearch = 
      item.staff?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.bunk?.bunk_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const bunkGender = getBunkGender(item.bunk);
    const matchesGender = genderFilter === "all" || 
      (genderFilter === "girls" && bunkGender === "girls") ||
      (genderFilter === "boys" && bunkGender === "boys");
    
    return matchesSearch && matchesGender;
  });

  // Filter for sign-in status in Off tab
  const getFilteredOffStaff = () => {
    const offStaff = filteredStaffWithBunk.filter(item =>
      item.dayOff?.is_day_off || item.dayOff?.is_night_off
    );
    
    if (signInStatusFilter === "all") return offStaff;
    if (signInStatusFilter === "signed_out") return offStaff.filter(item => item.dayOff?.checked_out && !item.dayOff?.checked_in);
    if (signInStatusFilter === "signed_in") return offStaff.filter(item => item.dayOff?.checked_in);
    if (signInStatusFilter === "not_signed_out") return offStaff.filter(item => !item.dayOff?.checked_out);
    
    return offStaff;
  };

  // Get staff who are due back (checked out but not checked in)
  const getDueBackStaff = () => {
    return filteredStaffWithBunk.filter(item =>
      staffIsScheduledOff(item.dayOff) &&
      item.dayOff?.checked_out &&
      !item.dayOff?.checked_in
    );
  };

  // Get Free Play staff (sleeping out)
  const getFreePlayStaff = () => {
    return filteredStaffWithBunk.filter(item => item.dayOff?.is_sleeping_out);
  };

  // Check if Free Play feature should be shown (hidden for Tyler Hill)
  const showFreePlay = currentCompany?.slug !== 'tyler-hill-camp';

  // Check if user can manually check in/out
  const canManualCheckInOut = userRole && ['admin', 'super_admin', 'staff', 'health_center'].includes(userRole);

  const navigateDate = (days: number) => {
    setSelectedDate(addDays(selectedDate, days));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">OD Management</h1>
          <p className="text-muted-foreground">
            Manage staff days off and bunk coverage
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* RFID Scanner Toggle */}
          <Button
            variant={scannerMode ? "default" : "outline"}
            onClick={toggleScannerMode}
            className={scannerMode ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Radio className={`h-4 w-4 mr-2 ${scannerMode ? "animate-pulse" : ""}`} />
            {scannerMode ? "Scanner Active" : "Scan Wristband"}
          </Button>

          <Button variant="outline" onClick={() => setShowScheduleUpload(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Schedule
          </Button>

          {/* Bunk Management */}
          <Button variant="outline" onClick={() => setShowBunkManagement(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Bunks
          </Button>

          {/* Date Navigation */}
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* RFID Scanner Input */}
      {scannerMode && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-green-800 dark:text-green-200 mb-1 block">
                Ready to scan wristband - Staff will be checked in/out automatically
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
              {isScanning ? "Scanning..." : "Submit"}
            </Button>
          </div>
        </div>
      )}

      {/* Uncovered Bunks Alert */}
      {uncoveredBunks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Uncovered Bunks</AlertTitle>
          <AlertDescription>
            The following bunks have no coverage for OD: {" "}
            {uncoveredBunks.map(b => b.bunk_name || `Bunk ${b.bunk_number}`).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Due Back Alert */}
      {getDueBackStaff().length > 0 && (
        <Alert className="border-warning bg-warning/10">
          <Clock className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Due Back</AlertTitle>
          <AlertDescription>
            The following staff have not signed back in: {" "}
            {getDueBackStaff().map(item => item.staff?.name).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <Label>Filter by Gender</Label>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="girls">Girls</SelectItem>
              <SelectItem value="boys">Boys</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="od">OD</TabsTrigger>
          <TabsTrigger value="off">Off</TabsTrigger>
          {showFreePlay && <TabsTrigger value="freeplay">Free Play</TabsTrigger>}
        </TabsList>

        <TabsContent value="od" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>On Duty Staff</CardTitle>
                  <CardDescription>
                    Staff members on duty for {format(selectedDate, "MMMM d, yyyy")}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or bunk..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bunk</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Out</TableHead>
                      {showFreePlay && <TableHead className="text-center">Free Play</TableHead>}
                      <TableHead className="text-center">In</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffWithBunk
                      .filter(item => !item.dayOff?.is_day_off)
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.bunk?.bunk_name || item.bunk?.bunk_number}
                              {getBunkGender(item.bunk) && (
                                <Badge variant="outline" className="text-xs">
                                  {getBunkGender(item.bunk) === 'girls' ? 'G' : 'B'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.staff?.name}
                              {item.staff?.rfid && (
                                <Badge variant="outline" className="text-xs">RFID</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.dayOff?.checked_out || false}
                              onCheckedChange={() => handleCheckInOut(item.staff_id, 'out')}
                              disabled={!canManualCheckInOut}
                            />
                          </TableCell>
                          {showFreePlay && (
                            <TableCell className="text-center">
                              <Checkbox
                                checked={item.dayOff?.is_sleeping_out || false}
                                onCheckedChange={() => handleToggleDayOff(item.staff_id, 'is_sleeping_out')}
                              />
                            </TableCell>
                          )}
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.dayOff?.checked_in || false}
                              onCheckedChange={() => handleCheckInOut(item.staff_id, 'in')}
                              disabled={!canManualCheckInOut}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleDayOff(item.staff_id, 'is_day_off')}
                              >
                                Mark Off
                              </Button>
                              <Button
                                variant={item.dayOff?.is_night_off ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => handleToggleDayOff(item.staff_id, 'is_night_off')}
                              >
                                <Moon className="h-3 w-3 mr-1" />
                                {item.dayOff?.is_night_off ? "Remove Night Off" : "Night Off"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openManageNights(item.staff_id, item.staff?.name || "Staff")}
                              >
                                Manage Nights
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {filteredStaffWithBunk.filter(item => !item.dayOff?.is_day_off).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {bunks.length === 0 
                            ? "No bunks configured. Click 'Manage Bunks' to set up bunks and assign staff."
                            : "No staff on duty found"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="off" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Staff Off</CardTitle>
                  <CardDescription>
                    Staff with a day off or night off for {format(selectedDate, "MMMM d, yyyy")}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={signInStatusFilter} onValueChange={setSignInStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="signed_out">Signed Out</SelectItem>
                      <SelectItem value="signed_in">Signed In</SelectItem>
                      <SelectItem value="not_signed_out">Not Signed Out</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or bunk..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bunk</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Times</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredOffStaff().map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.bunk?.bunk_name || item.bunk?.bunk_number}
                              {getBunkGender(item.bunk) && (
                                <Badge variant="outline" className="text-xs">
                                  {getBunkGender(item.bunk) === 'girls' ? 'G' : 'B'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {item.staff?.name}
                              {item.staff?.rfid && (
                                <Badge variant="outline" className="text-xs">RFID</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.dayOff?.checked_in || false}
                              onCheckedChange={() => handleCheckInOut(item.staff_id, 'in')}
                              disabled={!canManualCheckInOut}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {item.dayOff?.is_day_off && <Badge>Day Off</Badge>}
                              {item.dayOff?.is_night_off && <Badge variant="secondary">Night Off</Badge>}
                              {item.dayOff?.checked_out && <Badge variant="outline">Out</Badge>}
                              {item.dayOff?.checked_in && <Badge variant="outline" className="bg-green-100 dark:bg-green-900">In</Badge>}
                              {item.dayOff?.late_override && (
                                <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Override
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.dayOff?.checked_out_at && (
                              <div className="flex items-center gap-1">
                                <span>Out: {format(new Date(item.dayOff.checked_out_at), "h:mm a")}</span>
                                {item.dayOff?.checked_out_by_profile?.full_name && (
                                  <span className="text-xs text-primary">
                                    by {item.dayOff.checked_out_by_profile.full_name}
                                  </span>
                                )}
                              </div>
                            )}
                            {item.dayOff?.checked_in_at && (
                              <div className="flex items-center gap-1">
                                <span>In: {format(new Date(item.dayOff.checked_in_at), "h:mm a")}</span>
                                {item.dayOff?.checked_in_by_profile?.full_name && (
                                  <span className="text-xs text-primary">
                                    by {item.dayOff.checked_in_by_profile.full_name}
                                  </span>
                                )}
                              </div>
                            )}
                            {item.dayOff?.late_override_reason && (
                              <div className="text-yellow-600 text-xs mt-1">
                                Override: {item.dayOff.late_override_reason}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openManageNights(item.staff_id, item.staff?.name || "Staff")}
                              >
                                <Moon className="h-4 w-4 mr-1" />
                                Manage Nights
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStaffForSwap(item.staff_id);
                                  setShowSwapDialog(true);
                                }}
                              >
                                <ArrowLeftRight className="h-4 w-4 mr-1" />
                                Switch
                              </Button>
                              {item.dayOff?.is_day_off && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleDayOff(item.staff_id, 'is_day_off')}
                                >
                                  Remove Day Off
                                </Button>
                              )}
                              {item.dayOff?.is_night_off && !item.dayOff?.is_day_off && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleDayOff(item.staff_id, 'is_night_off')}
                                >
                                  Remove Night Off
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {getFilteredOffStaff().length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No staff with a day off or night off today
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {showFreePlay && (
          <TabsContent value="freeplay" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Free Play Shifts</CardTitle>
                <CardDescription>
                  Staff scheduled for Free Play for {format(selectedDate, "MMMM d, yyyy")}
                </CardDescription>
              </CardHeader>
              <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bunk</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFreePlayStaff().map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {item.bunk?.bunk_name || item.bunk?.bunk_number}
                            {getBunkGender(item.bunk) && (
                              <Badge variant="outline" className="text-xs">
                                {getBunkGender(item.bunk) === 'girls' ? 'G' : 'B'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.staff?.name}
                            {item.staff?.rfid && (
                              <Badge variant="outline" className="text-xs">RFID</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">Free Play</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleDayOff(item.staff_id, 'is_sleeping_out')}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {getFreePlayStaff().length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No staff scheduled for Free Play today
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Manage Nights Dialog */}
      <Dialog open={showManageNightsDialog} onOpenChange={setShowManageNightsDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Night Offs</DialogTitle>
            <DialogDescription>
              {manageNightsStaffName} — toggle night off for dates around{" "}
              {format(selectedDate, "MMMM d, yyyy")}. Day offs and night offs are scheduled independently
              (e.g. day off Wednesday, night off Friday/Monday/Tuesday).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {loadingNightSchedule ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading schedule...</p>
            ) : (
              nightOffSchedule.map((entry) => (
                <div
                  key={entry.date}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{formatNightOffScheduleLabel(entry.date)}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {entry.date === format(selectedDate, "yyyy-MM-dd") && (
                        <Badge variant="outline" className="text-xs">Selected day</Badge>
                      )}
                      {entry.is_day_off && <Badge className="text-xs">Day Off</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor={`night-${entry.date}`} className="text-xs text-muted-foreground">
                      Night off
                    </Label>
                    <Switch
                      id={`night-${entry.date}`}
                      checked={entry.is_night_off}
                      disabled={savingNightDate === entry.date || !manageNightsStaffId}
                      onCheckedChange={(checked) => {
                        if (manageNightsStaffId) {
                          void handleSetNightOffForDate(manageNightsStaffId, entry.date, checked);
                        }
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageNightsDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Day Off Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Day Off</DialogTitle>
            <DialogDescription>
              Select a new date for this staff member's day off. The current day off will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newSwapDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newSwapDate ? format(newSwapDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newSwapDate}
                    onSelect={setNewSwapDate}
                    initialFocus
                    disabled={(date) => date <= selectedDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSwapDayOff} disabled={!newSwapDate}>
              Switch Day Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Late Override Dialog */}
      <Dialog open={showLateOverrideDialog} onOpenChange={setShowLateOverrideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Late Sign-Out Override</DialogTitle>
            <DialogDescription>
              This staff member is not scheduled off today. Provide a reason to approve their late sign-out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Override Reason *</Label>
              <Textarea
                value={lateOverrideReason}
                onChange={(e) => setLateOverrideReason(e.target.value)}
                placeholder="Enter the reason for approving this late sign-out..."
                rows={3}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This override will be recorded with your user ID
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLateOverrideDialog(false);
              setLateOverrideStaffId(null);
              setLateOverrideReason("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleLateOverrideSubmit} 
              disabled={!lateOverrideReason.trim()}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Approve Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Schedule Dialog */}
      <Dialog open={showScheduleUpload} onOpenChange={setShowScheduleUpload}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Day & Night Off Schedule</DialogTitle>
            <DialogDescription>
              Import staff day offs and night offs from CSV or Excel. Matches staff by Person ID for the current season.
            </DialogDescription>
          </DialogHeader>
          <StaffDaysOffCSVUploader
            onUploadComplete={() => {
              fetchData();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleUpload(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bunk Management Dialog */}
      <Dialog open={showBunkManagement} onOpenChange={setShowBunkManagement}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bunk Management</DialogTitle>
            <DialogDescription>
              Configure bunks and assign staff members to each bunk
            </DialogDescription>
          </DialogHeader>
          <BunkManagement onClose={() => {
            setShowBunkManagement(false);
            fetchData();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
