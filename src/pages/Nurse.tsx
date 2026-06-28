import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pill, AlertCircle, CheckCircle2, Trash2, Calendar as CalendarIcon, LayoutList, Hospital, Clock, UserCheck, Search, ArrowUpDown, Users, Loader2, Scan, Pencil, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { CSVUploader } from "@/components/CSVUploader";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";
import { usePermissions } from "@/hooks/usePermissions";
import { lookupCamperOrStaffByRfid, lookupChildByRfid, normalizeRfidInput, resolveCamperOrStaffByRfid, findInListByRfid } from "@/lib/rfidUtils";
import { EditMedicationDialog } from "@/components/dialogs/EditMedicationDialog";
import {
  STANDARD_MEAL_SCHEDULE_HHMM,
  STANDARD_MEAL_LABEL_ORDER,
  resolveBedtimeOptionFromDivisionName,
  findBedtimeOptionFromStoredMealLabel,
} from "@/lib/medicationBedtimeOptions";
import { defaultMedicationStartDate } from "@/lib/medicationStartDate";
import {
  campProgramEndDate,
  childMatchesGenderFilter,
  findDaySpecificMedicationLog,
  medicationRowKey,
  medicationSlotKey,
  mergeMedicationsForDate,
  type MedicationLogRow,
} from "@/lib/medicationSchedule";
import {
  MedicationAdministrationPicker,
  MedicationAdministrationPickerDialog,
} from "@/components/health/MedicationAdministrationPicker";
import {
  MEDICATION_MEAL_FILTER_OPTIONS,
  medicationMatchesListVisibility,
} from "@/lib/medicationMealTimeDisplay";
import { MedicationMealTimeBadges } from "@/components/nurse/MedicationMealTimeBadges";

// Helper to check if we should show limited features for Timber Lake
const useTimberLakeMode = () => {
  const { currentCompany } = useCompany();
  return currentCompany?.slug === 'timber-lake-camp';
};

const localDateYmd = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function Nurse() {
  const isTimberLake = useTimberLakeMode();
  const { currentSeason } = useSeasonContext();
  const { currentCompany } = useCompany();
  const { getDivisionFilter, loading: permissionsLoading, userDivisionsKey } = usePermissions();
  const [children, setChildren] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [admissionHistory, setAdmissionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedChildForHistory, setSelectedChildForHistory] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [admissionType, setAdmissionType] = useState<'camper' | 'staff'>('camper');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [selectedGender, setSelectedGender] = useState<"all" | "boys" | "girls">("all");
  const [sortBy, setSortBy] = useState<'name' | 'division'>('name');
  const [medSortBy, setMedSortBy] = useState<'meal_time' | 'name' | 'status' | 'division' | 'gender'>('meal_time');
  const [medMealFilter, setMedMealFilter] = useState<string>("all");
  const [admissionNotesByAdmission, setAdmissionNotesByAdmission] = useState<
    Record<string, { id: string; note: string; created_at: string }[]>
  >({});
  const [newAdmissionNote, setNewAdmissionNote] = useState<Record<string, string>>({});
  const [unadministerTarget, setUnadministerTarget] = useState<any | null>(null);
  const [rfidInput, setRfidInput] = useState("");
  const [scannedChild, setScannedChild] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Health Center RFID state
  const [healthCenterRfidInput, setHealthCenterRfidInput] = useState("");
  const [healthCenterScannedEntity, setHealthCenterScannedEntity] = useState<any>(null);
  const [isHealthCenterScanning, setIsHealthCenterScanning] = useState(false);
  const [showAdmissionForm, setShowAdmissionForm] = useState(false);
  const [admissionReason, setAdmissionReason] = useState("");
  const [admissionNotes, setAdmissionNotes] = useState("");
  const [admissionMedSelection, setAdmissionMedSelection] = useState<Set<string>>(new Set());
  const [medicationPicker, setMedicationPicker] = useState<{
    child: { id: string; name: string; division?: { name?: string } | null };
    medications: any[];
  } | null>(null);
  const [medicationPickerSubmitting, setMedicationPickerSubmitting] = useState(false);
  
  // Edit medication state
  const [editingMedication, setEditingMedication] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const { userRole, isSuperAdmin } = usePermissions();
  
  // Check if user can edit/delete medications (admin or health_center)
  const canManageMedications = isSuperAdmin || userRole === 'admin' || userRole === 'health_center';

  const [formData, setFormData] = useState({
    medication_name: "",
    dosage: "",
    meal_times: [] as string[],
    notes: "",
    is_recurring: false,
    frequency: "daily",
    days_of_week: [] as string[],
    end_date: "",
  });

  useEffect(() => {
    // Wait for permissions to load before fetching
    if (permissionsLoading) return;
    fetchChildren();
    fetchStaff();
    fetchDivisions();
    fetchMedications(selectedDate);
    fetchAdmissions();
    fetchAdmissionHistory();
    fetchAdmissionNotes();

    // Realtime subscription for medication logs and health center admissions
    const channel = supabase
      .channel('medication-and-admissions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medication_logs' },
        () => fetchMedications(selectedDate)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'health_center_admissions' },
        () => {
          fetchAdmissions();
          fetchAdmissionHistory();
          fetchAdmissionNotes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'health_center_admission_notes' },
        () => fetchAdmissionNotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, currentSeason, currentCompany?.id, permissionsLoading, userDivisionsKey]);

  const fetchChildren = async () => {
    if (!currentCompany?.id) {
      setChildren([]);
      setLoading(false);
      return;
    }
    
    const divisionFilter = getDivisionFilter();
    
    let query = supabase
      .from("children")
      .select(`
        *,
        division:divisions(id, name, gender, sort_order)
      `)
      .eq("status", "active")
      .eq("season", currentSeason)
      .eq('company_id', currentCompany.id);
    
    // Apply division filter if user has limited access
    if (divisionFilter !== null && divisionFilter.length > 0) {
      query = query.in('division_id', divisionFilter);
    }
    
    const { data, error } = await query.order("name");

    if (error) {
      console.error("Error fetching children:", error);
      toast({ title: "Error fetching children", variant: "destructive" });
    } else {
      setChildren(data || []);
    }
    setLoading(false);
  };

  const fetchStaff = async () => {
    if (!currentCompany?.id) {
      setStaff([]);
      return;
    }
    
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("name");

    if (!error && data) {
      setStaff(data);
    }
  };

  const fetchDivisions = async () => {
    if (!currentCompany?.id) {
      setDivisions([]);
      return;
    }
    const { data, error } = await supabase
      .from("divisions")
      .select("*")
      .eq('company_id', currentCompany.id)
      .eq('is_active', true);

    if (error) {
      toast({ title: "Error fetching divisions", variant: "destructive" });
      return;
    }
    setDivisions(sortDivisionsAlternatingGender(data || []));
  };

  // Meal time order for sorting
  const MEAL_TIME_ORDER = [
    "Before Breakfast",
    "After Breakfast",
    "Before Lunch",
    "After Lunch",
    "Before Dinner",
    "After Dinner",
    "Bedtime"
  ];

  const getMealTimePriority = (mealTime: string[] | string | null): number => {
    if (!mealTime) return 999;
    const time = Array.isArray(mealTime) ? mealTime[0] : mealTime;
    const index = MEAL_TIME_ORDER.findIndex(mt => time?.includes(mt));
    if (index >= 0) return index;
    if (findBedtimeOptionFromStoredMealLabel(time)) return 6;
    return 999;
  };

  const sortMedicationsByMealTime = (meds: any[]) => {
    return [...meds].sort((a, b) => {
      const priorityA = getMealTimePriority(a.meal_time);
      const priorityB = getMealTimePriority(b.meal_time);
      return priorityA - priorityB;
    });
  };

  const sortMedicationsByName = (meds: any[]) => {
    return [...meds].sort((a, b) => {
      const nameA = a.children?.name || '';
      const nameB = b.children?.name || '';
      return nameA.localeCompare(nameB);
    });
  };

  const sortMedicationsByStatus = (meds: any[]) => {
    return [...meds].sort((a, b) => {
      // Pending first (false < true in this context, so we reverse)
      if (a.administered !== b.administered) {
        return a.administered ? 1 : -1;
      }
      // Then by meal time
      return getMealTimePriority(a.meal_time) - getMealTimePriority(b.meal_time);
    });
  };

  const getSortedMedications = (meds: any[]) => {
    const resolveChild = (med: (typeof medications)[0]) =>
      children.find((c) => c.id === med.child_id) ?? med.children;

    switch (medSortBy) {
      case 'name':
        return sortMedicationsByName(meds);
      case 'status':
        return sortMedicationsByStatus(meds);
      case 'division': {
        return [...meds].sort((a, b) => {
          const childA = resolveChild(a);
          const childB = resolveChild(b);
          const divA = childA?.division?.sort_order ?? 999;
          const divB = childB?.division?.sort_order ?? 999;
          if (divA !== divB) return divA - divB;
          const nameA = childA?.name || a.children?.name || '';
          const nameB = childB?.name || b.children?.name || '';
          return nameA.localeCompare(nameB);
        });
      }
      case 'gender': {
        return [...meds].sort((a, b) => {
          const childA = resolveChild(a);
          const childB = resolveChild(b);
          const gA = String(childA?.gender ?? childA?.division?.gender ?? '');
          const gB = String(childB?.gender ?? childB?.division?.gender ?? '');
          if (gA !== gB) return gA.localeCompare(gB);
          const nameA = childA?.name || a.children?.name || '';
          const nameB = childB?.name || b.children?.name || '';
          return nameA.localeCompare(nameB);
        });
      }
      case 'meal_time':
      default:
        return sortMedicationsByMealTime(meds);
    }
  };

  const fetchMedications = async (date?: Date) => {
    if (!currentCompany?.id) {
      setMedications([]);
      return;
    }

    const dateStr = date ? format(date, "yyyy-MM-dd") : localDateYmd();
    const baseSelect =
      "*, children(name, gender, division_id, division:divisions(name, gender, sort_order)), staff(name)";

    const [dateResult, recurringResult] = await Promise.all([
      supabase
        .from("medication_logs")
        .select(baseSelect)
        .eq("date", dateStr)
        .eq("season", currentSeason)
        .eq("company_id", currentCompany.id),
      supabase
        .from("medication_logs")
        .select(baseSelect)
        .eq("is_recurring", true)
        .eq("season", currentSeason)
        .eq("company_id", currentCompany.id)
        .lte("date", dateStr)
        .or(`end_date.is.null,end_date.gte.${dateStr}`),
    ]);

    if (dateResult.error || recurringResult.error) {
      toast({ title: "Error fetching medications", variant: "destructive" });
      return;
    }

    const merged = mergeMedicationsForDate(
      (dateResult.data || []) as MedicationLogRow[],
      (recurringResult.data || []) as MedicationLogRow[],
      dateStr,
      currentSeason,
    );

    setMedications(sortMedicationsByMealTime(merged));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (!selectedChild) {
      toast({ title: "Please select a child", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const standardMeals = formData.meal_times.filter((m) => m !== "Bedtime");
    const hasBedtime = formData.meal_times.includes("Bedtime");
    const childRow = children.find((c) => c.id === selectedChild);
    const divisionName = childRow?.division?.name as string | undefined;
    const bedtimeOpt = hasBedtime ? resolveBedtimeOptionFromDivisionName(divisionName) : undefined;

    if (standardMeals.length === 0 && !hasBedtime) {
      toast({ title: "Select at least one meal time", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (hasBedtime && !divisionName) {
      toast({
        title: "Camper has no division on file",
        description: "Assign a roster division before scheduling Bedtime.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    if (hasBedtime && !bedtimeOpt) {
      toast({
        title: "Bedtime not mapped for this division",
        description: `No bedtime rule matched "${divisionName}".`,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const medStartDate = defaultMedicationStartDate(currentSeason);

    const inserts = [
      ...standardMeals.map((mealTime) => ({
        child_id: selectedChild,
        date: medStartDate,
        medication_name: formData.medication_name,
        dosage: formData.dosage,
        meal_time: [mealTime],
        scheduled_time: STANDARD_MEAL_SCHEDULE_HHMM[mealTime] ?? "12:00",
        notes: formData.notes,
        is_recurring: formData.is_recurring,
        frequency: formData.frequency,
        days_of_week: formData.days_of_week,
        end_date: formData.is_recurring
          ? formData.end_date || campProgramEndDate(currentSeason)
          : formData.end_date || null,
        company_id: currentCompany?.id,
        season: currentSeason,
      })),
      ...(hasBedtime && bedtimeOpt
        ? [
            {
              child_id: selectedChild,
              date: medStartDate,
              medication_name: formData.medication_name,
              dosage: formData.dosage,
              meal_time: ["Bedtime"],
              scheduled_time: bedtimeOpt.scheduledTimeHHmm,
              notes: formData.notes,
              is_recurring: formData.is_recurring,
              frequency: formData.frequency,
              days_of_week: formData.days_of_week,
              end_date: formData.is_recurring
          ? formData.end_date || campProgramEndDate(currentSeason)
          : formData.end_date || null,
              company_id: currentCompany?.id,
              season: currentSeason,
            },
          ]
        : []),
    ];

    const { error } = await supabase.from("medication_logs").insert(inserts);

    if (error) {
      console.error("Medication insert error:", error);
      toast({
        title: "Error adding medication",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    toast({ title: `Medication added successfully for ${inserts.length} schedule slot(s)` });
    setFormData({ 
      medication_name: "", 
      dosage: "", 
      meal_times: [], 
      notes: "",
      is_recurring: false,
      frequency: "daily",
      days_of_week: [],
      end_date: "",
    });
    setSelectedChild("");
    setIsSubmitting(false);
    fetchMedications(selectedDate);
  };

  const handleSaveLateNotes = async (medId: string, notes: string) => {
    const { error } = await supabase
      .from("medication_logs")
      .update({
        late_notes: notes,
        late_notes_timestamp: new Date().toISOString(),
      })
      .eq("id", medId);

    if (error) {
      toast({ title: "Error saving notes", variant: "destructive" });
      return;
    }

    toast({ title: "Notes saved successfully" });
    fetchMedications(selectedDate);
  };

  const handleAdminister = async (med: any, options?: { silent?: boolean }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffData } = await supabase
      .from("staff")
      .select("id")
      .eq("email", user?.email)
      .maybeSingle();

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    if (med._fromRecurringTemplate) {
      const { data: dayLogs } = await supabase
        .from("medication_logs")
        .select("id, child_id, medication_name, meal_time")
        .eq("child_id", med.child_id)
        .eq("date", dateStr)
        .eq("company_id", currentCompany?.id)
        .eq("season", currentSeason);

      const existingDayLog = findDaySpecificMedicationLog(dayLogs || [], med);

      if (existingDayLog) {
        const { error } = await supabase
          .from("medication_logs")
          .update({
            administered: true,
            administered_by: staffData?.id ?? null,
            administered_at: new Date().toISOString(),
          })
          .eq("id", existingDayLog.id);

        if (error) {
          toast({ title: "Error updating medication", variant: "destructive" });
          return;
        }
      } else {
        const { error } = await supabase.from("medication_logs").insert({
          child_id: med.child_id,
          date: dateStr,
          medication_name: med.medication_name,
          dosage: med.dosage,
          meal_time: med.meal_time,
          scheduled_time: med.scheduled_time,
          notes: med.notes,
          is_recurring: false,
          frequency: med.frequency,
          days_of_week: med.days_of_week,
          end_date: med.end_date,
          company_id: currentCompany?.id,
          season: currentSeason,
          administered: true,
          administered_by: staffData?.id ?? null,
          administered_at: new Date().toISOString(),
        });

        if (error) {
          toast({ title: "Error updating medication", variant: "destructive" });
          return;
        }
      }
    } else {
      const { error } = await supabase
        .from("medication_logs")
        .update({
          administered: true,
          administered_by: staffData?.id ?? null,
          administered_at: new Date().toISOString(),
        })
        .eq("id", med.id);

      if (error) {
        toast({ title: "Error updating medication", variant: "destructive" });
        return;
      }
    }

    if (!options?.silent) {
      toast({ title: "Medication marked as administered" });
    }
    const rowKey = medicationRowKey(med);
    const administeredAt = new Date().toISOString();
    setMedications((prev) =>
      prev.map((row) =>
        medicationRowKey(row) === rowKey
          ? { ...row, administered: true, administered_at: administeredAt }
          : row,
      ),
    );
    fetchMedications(selectedDate);
  };

  const handleUnadminister = async (med: any) => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    setUnadministerTarget(null);

    let targetId = med.id as string;

    if (med._fromRecurringTemplate) {
      const { data: dayLogs, error: lookupError } = await supabase
        .from("medication_logs")
        .select("id, child_id, medication_name, meal_time")
        .eq("child_id", med.child_id)
        .eq("date", dateStr)
        .eq("company_id", currentCompany?.id)
        .eq("season", currentSeason);

      if (lookupError) {
        toast({ title: "Error updating medication", variant: "destructive" });
        return;
      }

      const match = findDaySpecificMedicationLog(dayLogs || [], med);
      if (!match) {
        toast({
          title: "Nothing to undo",
          description: "No administration record exists for this date.",
          variant: "destructive",
        });
        return;
      }
      targetId = match.id;
    }

    const { error } = await supabase
      .from("medication_logs")
      .update({
        administered: false,
        administered_by: null,
        administered_at: null,
      })
      .eq("id", targetId);

    if (error) {
      toast({ title: "Error updating medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication marked as not administered" });
    const rowKey = medicationRowKey(med);
    setMedications((prev) =>
      prev.map((row) =>
        medicationRowKey(row) === rowKey
          ? { ...row, administered: false, administered_by: null, administered_at: null }
          : row,
      ),
    );
    fetchMedications(selectedDate);
  };

  const handleMedicationCheckChange = (med: any, checked: boolean) => {
    if (checked) {
      if (!med.administered) void handleAdminister(med);
      return;
    }
    if (med.administered) setUnadministerTarget(med);
  };

  const handleRfidScan = async () => {
    const rfidValue = normalizeRfidInput(rfidInput);
    if (!rfidValue) {
      toast({ 
        title: "Please enter or scan an RFID", 
        variant: "destructive" 
      });
      return;
    }

    if (!currentCompany?.id || !currentSeason) {
      toast({
        title: "Scan unavailable",
        description: "Company or season is not loaded.",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    
    try {
      const childMatch =
        (await lookupChildByRfid(rfidValue, currentCompany.id, currentSeason)) ??
        findInListByRfid(children, rfidValue);
      const child = childMatch ?? null;

      if (!child) {
        toast({
          title: "RFID Not Found",
          description: "No camper found with this RFID bracelet",
          variant: "destructive"
        });
        setRfidInput("");
        setIsScanning(false);
        return;
      }

      const { data: childDetails } = await supabase
        .from('children')
        .select('*, division:divisions(name)')
        .eq('id', child.id)
        .single();

      const resolvedChild = childDetails ?? child;

      // Get current user (nurse/staff)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, name")
        .eq("email", user?.email)
        .single();

      // Find all unadministered medications for this child today
      const todayMeds = activeListMedications.filter(
        med => med.child_id === child.id && !med.administered
      );

      if (todayMeds.length === 0) {
        toast({
          title: "No Medications Pending",
          description: `${resolvedChild.name} has no medications to administer today`,
        });
        setScannedChild(resolvedChild);
        setRfidInput("");
        setIsScanning(false);
        return;
      }

      setMedicationPicker({
        child: resolvedChild,
        medications: todayMeds,
      });
      setRfidInput("");

    } catch (error) {
      console.error('RFID scan error:', error);
      toast({
        title: "Scan Error",
        description: "An error occurred while processing the RFID scan",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleRfidKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRfidScan();
    }
  };

  const handleDelete = async (medId: string) => {
    const { error } = await supabase
      .from("medication_logs")
      .delete()
      .eq("id", medId);

    if (error) {
      toast({ title: "Error deleting medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication deleted successfully" });
    fetchMedications();
  };

  const fetchAdmissions = async () => {
    if (!currentCompany?.id) {
      setAdmissions([]);
      return;
    }

    const { data, error } = await supabase
      .from("health_center_admissions")
      .select(`
        *,
        children!fk_health_center_admissions_child_id (
          id,
          name,
          division_id,
          division:division_id (
            name
          )
        ),
        staff (
          id,
          name,
          role,
          allergies
        )
      `)
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .is("checked_out_at", null)
      .order("admitted_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching admissions", variant: "destructive" });
      return;
    }
    
    // Filter child admissions by allowed divisions; staff admissions stay camp-scoped above
    const divisionFilter = getDivisionFilter();
    if (divisionFilter !== null && divisionFilter.length > 0) {
      const filtered = (data || []).filter(admission => {
        if (!admission.child_id) return true;
        return admission.children?.division_id && divisionFilter.includes(admission.children.division_id);
      });
      setAdmissions(filtered);
    } else {
      setAdmissions(data || []);
    }
  };

  const fetchAdmissionHistory = async (childId?: string) => {
    if (!currentCompany?.id) {
      setAdmissionHistory([]);
      return;
    }

    let query = supabase
      .from("health_center_admissions")
      .select(`
        *,
        children!fk_health_center_admissions_child_id (
          id,
          name,
          division_id,
          division:division_id (
            name
          )
        ),
        staff (
          id,
          name,
          role,
          allergies
        )
      `)
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .not("checked_out_at", "is", null)
      .order("admitted_at", { ascending: false });

    if (childId) {
      query = query.eq("child_id", childId);
    }

    const { data, error } = await query;
    
    if (!error && data) {
      const divisionFilter = getDivisionFilter();
      if (divisionFilter !== null && divisionFilter.length > 0) {
        const filtered = data.filter(admission => {
          if (!admission.child_id) return true;
          return admission.children?.division_id && divisionFilter.includes(admission.children.division_id);
        });
        setAdmissionHistory(filtered);
      } else {
        setAdmissionHistory(data);
      }
    }
  };

  const fetchAdmissionNotes = async () => {
    if (!currentCompany?.id) return;

    const { data, error } = await supabase
      .from("health_center_admission_notes")
      .select("id, admission_id, note, created_at")
      .eq("company_id", currentCompany.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Admission notes unavailable (run migration if needed):", error.message);
      return;
    }

    const grouped: Record<string, { id: string; note: string; created_at: string }[]> = {};
    (data || []).forEach((row: { id: string; admission_id: string; note: string; created_at: string }) => {
      if (!grouped[row.admission_id]) grouped[row.admission_id] = [];
      grouped[row.admission_id].push({
        id: row.id,
        note: row.note,
        created_at: row.created_at,
      });
    });
    setAdmissionNotesByAdmission(grouped);
  };

  const handleAddAdmissionNote = async (admissionId: string) => {
    const text = (newAdmissionNote[admissionId] || "").trim();
    if (!text || !currentCompany?.id) return;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("health_center_admission_notes").insert({
      admission_id: admissionId,
      company_id: currentCompany.id,
      note: text,
      created_by: user?.id ?? null,
    });

    if (error) {
      toast({
        title: "Could not save note",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setNewAdmissionNote((prev) => ({ ...prev, [admissionId]: "" }));
    toast({ title: "Note added" });
    fetchAdmissionNotes();
  };

  const handleAdmit = async (
    entityId: string,
    entityType: 'child' | 'staff',
    reason: string,
    notes: string,
    options?: { silent?: boolean },
  ) => {
    if (!currentCompany?.id) {
      toast({ title: "No camp selected", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    const checkColumn = entityType === 'child' ? 'child_id' : 'staff_id';
    const { data: existing } = await supabase
      .from("health_center_admissions")
      .select("id")
      .eq("company_id", currentCompany.id)
      .eq(checkColumn, entityId)
      .is("checked_out_at", null)
      .maybeSingle();

    if (existing) {
      toast({ title: `${entityType === 'child' ? 'Child' : 'Staff member'} is already admitted`, variant: "destructive" });
      return;
    }

    const insertData: any = {
      admitted_by: user?.id,
      reason,
      notes,
      season: currentSeason,
      company_id: currentCompany.id,
    };

    if (entityType === 'child') {
      insertData.child_id = entityId;
    } else {
      insertData.staff_id = entityId;
    }

    const { error } = await supabase
      .from("health_center_admissions")
      .insert(insertData);

    if (error) {
      toast({ title: "Error admitting to Health Center", variant: "destructive" });
      console.error(error);
      return;
    }

    if (!options?.silent) {
      toast({ title: `${entityType === 'child' ? 'Child' : 'Staff member'} admitted to Health Center` });
    }
    fetchAdmissions();
  };

  const handleCheckout = async (admissionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("health_center_admissions")
      .update({
        checked_out_at: new Date().toISOString(),
        checked_out_by: user?.id,
      })
      .eq("id", admissionId);

    if (error) {
      toast({ title: "Error checking out child", variant: "destructive" });
      return;
    }

    toast({ title: "Checked out successfully" });
    fetchAdmissions();
    fetchAdmissionHistory();
    return true;
  };

  // Health Center RFID Scan Handler
  const handleHealthCenterRfidScan = async () => {
    const rfidValue = normalizeRfidInput(healthCenterRfidInput);
    if (!rfidValue) {
      toast({ 
        title: "Please enter or scan an RFID", 
        variant: "destructive" 
      });
      return;
    }

    if (!currentCompany?.id || !currentSeason) {
      toast({
        title: "Scan unavailable",
        description: "Company or season is not loaded.",
        variant: "destructive",
      });
      return;
    }

    setIsHealthCenterScanning(true);
    
    try {
      const match = await resolveCamperOrStaffByRfid(
        rfidValue,
        currentCompany.id,
        currentSeason,
        { campers: children, staff },
      );

      if (!match) {
        toast({
          title: "RFID Not Found",
          description: "No camper or staff found with this RFID",
          variant: "destructive"
        });
        setHealthCenterRfidInput("");
        setIsHealthCenterScanning(false);
        return;
      }

      const { entity, isStaff } = match;
      const entityType = isStaff ? 'staff' : 'child';

      // Check if already admitted
      const checkColumn = entityType === 'child' ? 'child_id' : 'staff_id';
      const { data: existingAdmission } = await supabase
        .from("health_center_admissions")
        .select("id")
        .eq("company_id", currentCompany.id)
        .eq(checkColumn, entity.id)
        .is("checked_out_at", null)
        .maybeSingle();

      if (existingAdmission) {
        // Auto check-out
        await handleCheckout(existingAdmission.id);
        toast({
          title: "✓ Checked Out",
          description: `${entity.name} has been checked out of the Health Center`,
        });
        setHealthCenterScannedEntity({ ...entity, action: 'checkout', entityType });
        setHealthCenterRfidInput("");
        setTimeout(() => setHealthCenterScannedEntity(null), 3000);
      } else {
        // Show admission form
        setHealthCenterScannedEntity({ ...entity, action: 'admit', entityType });
        setAdmissionMedSelection(new Set());
        setShowAdmissionForm(true);
        setHealthCenterRfidInput("");
      }

    } catch (error) {
      console.error('Health Center RFID scan error:', error);
      toast({
        title: "Scan Error",
        description: "An error occurred while processing the RFID scan",
        variant: "destructive"
      });
    } finally {
      setIsHealthCenterScanning(false);
    }
  };

  const handleHealthCenterRfidKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleHealthCenterRfidScan();
    }
  };

  const handleConfirmAdmission = async () => {
    if (!healthCenterScannedEntity) return;

    const pendingAdmissionMeds =
      healthCenterScannedEntity.entityType === 'child'
        ? activeListMedications.filter(
            (med) =>
              med.child_id === healthCenterScannedEntity.id && !med.administered,
          )
        : [];
    const selectedAdmissionMeds = pendingAdmissionMeds.filter((med) =>
      admissionMedSelection.has(medicationRowKey(med)),
    );

    await handleAdmit(
      healthCenterScannedEntity.id,
      healthCenterScannedEntity.entityType,
      admissionReason,
      admissionNotes,
      { silent: true },
    );

    if (selectedAdmissionMeds.length > 0) {
      for (const med of selectedAdmissionMeds) {
        await handleAdminister(med, { silent: true });
      }
      toast({
        title: "✓ Admitted",
        description: `${healthCenterScannedEntity.name} admitted and ${selectedAdmissionMeds.length} medication(s) marked as given`,
      });
    } else {
      toast({
        title: "✓ Admitted",
        description: `${healthCenterScannedEntity.name} has been admitted to the Health Center`,
      });
    }
    
    // Reset form
    setShowAdmissionForm(false);
    setAdmissionReason("");
    setAdmissionNotes("");
    setAdmissionMedSelection(new Set());
    setTimeout(() => setHealthCenterScannedEntity(null), 3000);
  };

  const handleCancelAdmission = () => {
    setShowAdmissionForm(false);
    setHealthCenterScannedEntity(null);
    setAdmissionReason("");
    setAdmissionNotes("");
    setAdmissionMedSelection(new Set());
  };

  const handleMedicationPickerConfirm = async (selected: any[]) => {
    if (selected.length === 0) return;
    setMedicationPickerSubmitting(true);
    try {
      for (const med of selected) {
        await handleAdminister(med, { silent: true });
      }
      toast({
        title: "✓ Medication Administered",
        description: `${selected.length} medication(s) marked as given for ${medicationPicker?.child.name ?? "camper"}`,
      });
      setMedicationPicker(null);
    } finally {
      setMedicationPickerSubmitting(false);
    }
  };

  const getAdmissionDuration = (admittedAt: string, checkedOutAt?: string | null) => {
    const start = new Date(admittedAt);
    const end = checkedOutAt ? new Date(checkedOutAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  // Group admission history by child or staff member
  const groupedHistory = admissionHistory.reduce((acc: any, admission: any) => {
    const key = admission.child_id || admission.staff_id;
    if (!key) return acc;
    if (!acc[key]) {
      acc[key] = {
        child: admission.children,
        staff: admission.staff,
        admissions: [],
      };
    }
    acc[key].admissions.push(admission);
    return acc;
  }, {});

  const filteredChildren = children
    .filter(child =>
      child.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedDivision === "all" || child.division_id === selectedDivision) &&
      childMatchesGenderFilter(child, selectedGender)
    )
    .sort((a, b) => {
      if (sortBy === "division") {
        const divA = a.division?.sort_order || 999;
        const divB = b.division?.sort_order || 999;
        if (divA !== divB) return divA - divB;
      }
      return a.name.localeCompare(b.name);
    });

  const filteredStaff = staff
    .filter(member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const visibleChildIds = new Set(filteredChildren.map((child) => child.id));

  const childForMedication = (med: { child_id: string; children?: { name?: string; division?: { name?: string } } }) =>
    children.find((c) => c.id === med.child_id) ?? med.children;

  const medMatchesActiveListRules = (med: (typeof medications)[0]) => {
    const child = childForMedication(med);
    const divisionName =
      (child && "division" in child ? child.division?.name : null) ??
      med.children?.division?.name ??
      null;
    const childName =
      (child && "name" in child ? child.name : null) ?? med.children?.name ?? "";

    return medicationMatchesListVisibility(med, {
      searchQuery: searchQuery,
      mealFilter: medMealFilter,
      divisionName,
      childName,
    });
  };

  const visibleMedications = medications.filter((med) => visibleChildIds.has(med.child_id));
  const activeListMedications = visibleMedications.filter(medMatchesActiveListRules);

  const childrenWithActiveMeds = filteredChildren.filter((child) =>
    activeListMedications.some((med) => med.child_id === child.id),
  );

  const sortedChildrenForMedList = [...childrenWithActiveMeds].sort((a, b) => {
    switch (medSortBy) {
      case 'division': {
        const divA = a.division?.sort_order ?? 999;
        const divB = b.division?.sort_order ?? 999;
        if (divA !== divB) return divA - divB;
        return a.name.localeCompare(b.name);
      }
      case 'gender': {
        const gA = String(a.gender ?? a.division?.gender ?? '');
        const gB = String(b.gender ?? b.division?.gender ?? '');
        if (gA !== gB) return gA.localeCompare(gB);
        return a.name.localeCompare(b.name);
      }
      case 'status': {
        const pendingA = activeListMedications.some(
          (med) => med.child_id === a.id && !med.administered,
        );
        const pendingB = activeListMedications.some(
          (med) => med.child_id === b.id && !med.administered,
        );
        if (pendingA !== pendingB) return pendingA ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      case 'name':
        return a.name.localeCompare(b.name);
      case 'meal_time':
      default: {
        const priorityA = Math.min(
          ...activeListMedications
            .filter((med) => med.child_id === a.id)
            .map((med) => getMealTimePriority(med.meal_time)),
        );
        const priorityB = Math.min(
          ...activeListMedications
            .filter((med) => med.child_id === b.id)
            .map((med) => getMealTimePriority(med.meal_time)),
        );
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.name.localeCompare(b.name);
      }
    }
  });

  const renderMedSortFilterControls = () => (
    <div className="flex flex-row flex-nowrap items-center gap-2">
      <Select value={medMealFilter} onValueChange={setMedMealFilter}>
        <SelectTrigger className="w-[180px] shrink-0">
          <SelectValue placeholder="Filter meal time" />
        </SelectTrigger>
        <SelectContent>
          {MEDICATION_MEAL_FILTER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={medSortBy}
        onValueChange={(value: 'meal_time' | 'name' | 'status' | 'division' | 'gender') =>
          setMedSortBy(value)
        }
      >
        <SelectTrigger className="w-[180px] shrink-0">
          <ArrowUpDown className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="meal_time">Sort by Meal Time</SelectItem>
          <SelectItem value="name">Sort by Name</SelectItem>
          <SelectItem value="division">Sort by Division</SelectItem>
          <SelectItem value="gender">Sort by Gender</SelectItem>
          <SelectItem value="status">Sort by Status</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const renderMedicationMetaBadges = (
    med: (typeof medications)[0],
    divisionName?: string | null,
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      {med.is_recurring && (
        <Badge variant="secondary" className="text-xs">
          Recurring
        </Badge>
      )}
      <MedicationMealTimeBadges mealTime={med.meal_time} divisionName={divisionName} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Nurse Dashboard</h1>
          <p className="text-muted-foreground">Manage children's daily medications</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 border rounded-md p-1 bg-muted/50">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <LayoutList className="h-4 w-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </div>
          <CSVUploader tableName="medication_logs" onUploadComplete={() => fetchMedications(selectedDate)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by child name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedDivision} onValueChange={setSelectedDivision}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Divisions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                {divisions.map((div) => (
                  <SelectItem key={div.id} value={div.id}>
                    {div.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedGender} onValueChange={(v: "all" | "boys" | "girls") => setSelectedGender(v)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Genders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="boys">Boys</SelectItem>
                <SelectItem value="girls">Girls</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline"
              onClick={() => setSortBy(sortBy === "name" ? "division" : "name")}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Sort by {sortBy === "name" ? "Division" : "Name"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'calendar' && (
        <div className="grid lg:grid-cols-[350px_1fr] gap-6">
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Medications for {format(selectedDate, 'MMMM d, yyyy')}</CardTitle>
              <CardDescription>
                {isBefore(startOfDay(selectedDate), startOfDay(new Date())) 
                  ? 'Past date - View only with notes option' 
                  : isToday(selectedDate)
                  ? 'Today - Mark medications as administered'
                  : 'Future date - Pre-schedule medications'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : activeListMedications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for this date</p>
              ) : (
                <div className="space-y-4">
                  {filteredChildren
                    .filter(child => activeListMedications.some(med => med.child_id === child.id))
                    .map((child) => {
                      const childMeds = activeListMedications.filter(med => med.child_id === child.id);
                      return (
                        <div key={child.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{child.name}</h3>
                            {child.division?.name && (
                              <Badge variant="outline" className="text-xs">
                                {child.division.name}
                              </Badge>
                            )}
                          </div>
                            {sortMedicationsByMealTime(childMeds).map((med) => {
                            const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
                            return (
                              <div key={`${med.id}-${med._displayDate ?? med.date}`} className="p-3 bg-muted/50 rounded space-y-2">
                                <div className="flex items-start gap-3">
                                  {!isPastDate && (
                                    <Checkbox
                                      checked={med.administered}
                                      onCheckedChange={(checked) =>
                                        handleMedicationCheckChange(med, checked === true)
                                      }
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">{med.medication_name}</span>
                                      {med.administered && (
                                        <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Given
                                        </Badge>
                                      )}
                                      {renderMedicationMetaBadges(med, child.division?.name)}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">{med.dosage}</p>
                                    {med.notes && (
                                      <p className="text-sm text-muted-foreground mt-1">{med.notes}</p>
                                    )}
                                  </div>
                                  {canManageMedications && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setEditingMedication(med);
                                          setIsEditDialogOpen(true);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(med._fromRecurringTemplate ? med._templateId : med.id)}
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                
                                {isPastDate && (
                                  <div className="space-y-2 mt-2">
                                    <Label className="text-xs">Late Notes (optional)</Label>
                                    <Textarea
                                      placeholder="Add notes here..."
                                      defaultValue={med.late_notes || ""}
                                      onBlur={(e) => {
                                        if (e.target.value !== (med.late_notes || "")) {
                                          handleSaveLateNotes(med.id, e.target.value);
                                        }
                                      }}
                                      rows={2}
                                      className="text-sm"
                                    />
                                    {med.late_notes_timestamp && (
                                      <p className="text-xs text-muted-foreground">
                                        Last updated: {format(new Date(med.late_notes_timestamp), 'MMM d, yyyy h:mm a')}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'list' && (
        <>
          <Tabs defaultValue="log" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="log">Daily Log</TabsTrigger>
          <TabsTrigger value="today">Today's Medications</TabsTrigger>
          <TabsTrigger value="health-center">Health Center</TabsTrigger>
          <TabsTrigger value="health-log">Health Center Log</TabsTrigger>
          <TabsTrigger value="add">Add Medication</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <div>
                  <CardTitle>Daily Medication Log</CardTitle>
                  <CardDescription>
                    Mark off medications administered today. As-needed meds stay on the camper profile only. Given meds and meds without a meal time are hidden — search by child or medication name to find them.
                  </CardDescription>
                </div>
                {renderMedSortFilterControls()}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : activeListMedications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for today</p>
              ) : (
                <div className="space-y-4">
                  {sortedChildrenForMedList.map((child) => {
                      const childMeds = getSortedMedications(
                        activeListMedications.filter(med => med.child_id === child.id),
                      );
                      return (
                        <div key={child.id} className="border rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-semibold">{child.name}</h3>
                            {child.division?.name && (
                              <Badge variant="outline" className="text-xs">
                                {child.division.name}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-2">
                            {childMeds.map((med) => (
                              <div key={`${med.id}-${med._displayDate ?? med.date}`} className="flex items-start gap-3 p-3 bg-muted/50 rounded">
                                <Checkbox
                                  checked={med.administered}
                                  onCheckedChange={(checked) =>
                                    handleMedicationCheckChange(med, checked === true)
                                  }
                                />
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{med.medication_name}</span>
                                    {med.administered && (
                                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Given
                                      </Badge>
                                    )}
                                    {renderMedicationMetaBadges(med, child.division?.name)}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{med.dosage}</p>
                                  {/* Show start/end date info */}
                                  {(med.date || med.end_date) && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <CalendarDays className="h-3 w-3" />
                                      <span>
                                        {med.date && `Started: ${format(new Date(med.date + 'T00:00:00'), 'MMM d')}`}
                                        {med.end_date && ` • Ends: ${format(new Date(med.end_date + 'T00:00:00'), 'MMM d')}`}
                                      </span>
                                    </div>
                                  )}
                                  {med.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">{med.notes}</p>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  {canManageMedications && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingMedication(med);
                                        setIsEditDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {canManageMedications && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(med._fromRecurringTemplate ? med._templateId : med.id)}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <div>
                  <CardTitle>Today's Medications</CardTitle>
                  <CardDescription>
                    Track medication administration. As-needed meds stay on the camper profile only. Given meds and meds without a meal time are hidden — search by child or medication name to find them.
                  </CardDescription>
                </div>
                {renderMedSortFilterControls()}
              </div>
            </CardHeader>
            <CardContent>
              {/* RFID Scanner Section */}
              <Card className="mb-4 border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Scan className="h-5 w-5" />
                    RFID Quick Check-In
                  </CardTitle>
                  <CardDescription>
                    Scan camper's RFID bracelet to choose which medications to administer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Scan or type RFID..."
                        value={rfidInput}
                        onChange={(e) => setRfidInput(e.target.value)}
                        onKeyPress={handleRfidKeyPress}
                        disabled={isScanning}
                        autoFocus
                        className="text-lg"
                      />
                    </div>
                    <Button 
                      onClick={handleRfidScan}
                      disabled={isScanning || !rfidInput.trim()}
                    >
                      {isScanning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Scan className="h-4 w-4 mr-2" />
                          Scan
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setRfidInput("");
                        setScannedChild(null);
                      }}
                      disabled={isScanning}
                    >
                      Clear
                    </Button>
                  </div>

                  {/* Success Confirmation */}
                  {scannedChild && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div>
                          <p className="font-medium text-green-900 dark:text-green-100">
                            {scannedChild.name}
                          </p>
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {scannedChild.division?.name} • RFID: {scannedChild.rfid}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : activeListMedications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for today</p>
              ) : (
                <div className="space-y-3">
                  {getSortedMedications(activeListMedications).map((med) => (
                    <div
                      key={`${med.id}-${med._displayDate ?? med.date}`}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium">{med.children?.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                              {med.medication_name} - {med.dosage}
                            </span>
                            {med.administered && (
                              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3" />
                                Given
                              </Badge>
                            )}
                            {renderMedicationMetaBadges(med, med.children?.division?.name)}
                          </div>
                          {/* Show start/end date info */}
                          {(med.date || med.end_date) && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <CalendarDays className="h-3 w-3" />
                              <span>
                                {med.date && `Started: ${format(new Date(med.date + 'T00:00:00'), 'MMM d')}`}
                                {med.end_date && ` • Ends: ${format(new Date(med.end_date + 'T00:00:00'), 'MMM d')}`}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canManageMedications && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingMedication(med);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canManageMedications && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(med._fromRecurringTemplate ? med._templateId : med.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {med.administered ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUnadministerTarget(med)}
                          className="w-full mt-2"
                        >
                          Mark as Not Administered
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAdminister(med)}
                          className="w-full mt-2"
                        >
                          Mark as Administered
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health-center">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Hospital className="h-5 w-5 text-primary" />
                <CardTitle>Health Center Admissions</CardTitle>
              </div>
              <CardDescription>Track overnight admissions to the health center</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* RFID Quick Check-In/Out Scanner */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Scan className="h-5 w-5" />
                    RFID Quick Check-In / Check-Out
                  </CardTitle>
                  <CardDescription>
                    Scan RFID to admit or check out - system auto-detects the action
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Scan or type RFID..."
                        value={healthCenterRfidInput}
                        onChange={(e) => setHealthCenterRfidInput(e.target.value)}
                        onKeyPress={handleHealthCenterRfidKeyPress}
                        disabled={isHealthCenterScanning || showAdmissionForm}
                        className="text-lg"
                      />
                    </div>
                    <Button 
                      onClick={handleHealthCenterRfidScan}
                      disabled={isHealthCenterScanning || !healthCenterRfidInput.trim() || showAdmissionForm}
                    >
                      {isHealthCenterScanning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Scan className="h-4 w-4 mr-2" />
                          Scan
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setHealthCenterRfidInput("");
                        setHealthCenterScannedEntity(null);
                        setShowAdmissionForm(false);
                        setAdmissionReason("");
                        setAdmissionNotes("");
                      }}
                      disabled={isHealthCenterScanning}
                    >
                      Clear
                    </Button>
                  </div>

                  {/* Admission Form after RFID scan */}
                  {showAdmissionForm && healthCenterScannedEntity && (
                    <div className="mt-4 p-4 bg-accent/50 border rounded-lg space-y-4">
                      <div className="flex items-center gap-2">
                        <Hospital className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold text-lg">{healthCenterScannedEntity.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {healthCenterScannedEntity.division?.name || healthCenterScannedEntity.role || "Unknown"} 
                            {healthCenterScannedEntity.entityType === 'staff' && " (Staff)"}
                          </p>
                        </div>
                      </div>
                      
                      {healthCenterScannedEntity.allergies && (
                        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded">
                          <span className="font-medium text-destructive text-sm">⚠️ Allergies: </span>
                          <span className="text-destructive text-sm">{healthCenterScannedEntity.allergies}</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Reason for Admission</Label>
                        <Input
                          placeholder="Enter reason..."
                          value={admissionReason}
                          onChange={(e) => setAdmissionReason(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Additional Notes</Label>
                        <Textarea
                          placeholder="Enter any additional notes..."
                          value={admissionNotes}
                          onChange={(e) => setAdmissionNotes(e.target.value)}
                          rows={2}
                        />
                      </div>

                      {healthCenterScannedEntity.entityType === 'child' && (
                        <div className="space-y-2">
                          <Label>Administer medications now (optional)</Label>
                          <p className="text-xs text-muted-foreground">
                            Select only the medications you are giving during this visit. Nothing is marked until you admit.
                          </p>
                          <MedicationAdministrationPicker
                            medications={activeListMedications.filter(
                              (med) =>
                                med.child_id === healthCenterScannedEntity.id &&
                                !med.administered,
                            )}
                            divisionName={healthCenterScannedEntity.division?.name}
                            selectedKeys={admissionMedSelection}
                            onSelectedKeysChange={setAdmissionMedSelection}
                          />
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={handleCancelAdmission}>
                          Cancel
                        </Button>
                        <Button onClick={handleConfirmAdmission}>
                          <Hospital className="h-4 w-4 mr-2" />
                          Admit to Health Center
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Success Confirmation */}
                  {healthCenterScannedEntity && !showAdmissionForm && (
                    <div className={`mt-3 p-3 border rounded-lg ${
                      healthCenterScannedEntity.action === 'checkout' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    }`}>
                      <div className="flex items-center gap-2">
                        {healthCenterScannedEntity.action === 'checkout' ? (
                          <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        )}
                        <div>
                          <p className={`font-medium ${
                            healthCenterScannedEntity.action === 'checkout'
                              ? 'text-blue-900 dark:text-blue-100'
                              : 'text-green-900 dark:text-green-100'
                          }`}>
                            {healthCenterScannedEntity.name} - {healthCenterScannedEntity.action === 'checkout' ? 'Checked Out' : 'Admitted'}
                          </p>
                          <p className={`text-sm ${
                            healthCenterScannedEntity.action === 'checkout'
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-green-700 dark:text-green-300'
                          }`}>
                            {healthCenterScannedEntity.division?.name || healthCenterScannedEntity.role || ""}
                            {healthCenterScannedEntity.entityType === 'staff' && " (Staff)"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Type Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg max-w-xs">
                <Button
                  type="button"
                  variant={admissionType === 'camper' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setAdmissionType('camper')}
                >
                  Campers
                </Button>
                <Button
                  type="button"
                  variant={admissionType === 'staff' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setAdmissionType('staff')}
                >
                  Staff
                </Button>
              </div>

              {/* Search Bar */}
              <div className="space-y-2">
                <Label>Search {admissionType === 'camper' ? 'Children' : 'Staff'}</Label>
                <Input
                  placeholder={`Search ${admissionType === 'camper' ? 'children' : 'staff'} by name...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Currently Admitted Section */}
              {admissions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Currently Admitted ({admissions.length})
                  </h3>
                  <div className="grid gap-3">
                    {admissions.map((admission) => {
                      const child = admission.children;
                      const staffMember = admission.staff;
                      const entity = child || staffMember;
                      const entityType = child ? 'Camper' : 'Staff';
                      
                      return (
                        <div key={admission.id} className="border rounded-lg p-4 bg-destructive/5">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-lg">{entity?.name || 'Unknown'}</h4>
                                <Badge variant={child ? "outline" : "secondary"} className="text-xs">
                                  {entityType}
                                </Badge>
                                {entity?.allergies && (
                                  <Badge variant="destructive" className="text-xs">
                                    ⚠️ Allergies
                                  </Badge>
                                )}
                              </div>
                              {entity?.allergies && (
                                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded mb-2">
                                  <span className="font-medium text-destructive text-sm">⚠️ Allergies: </span>
                                  <span className="text-destructive text-sm">{entity.allergies}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <Clock className="h-4 w-4" />
                                <span>Admitted {format(new Date(admission.admitted_at), 'MMM d, h:mm a')}</span>
                                <Badge variant="outline" className="ml-2">
                                  {getAdmissionDuration(admission.admitted_at)}
                                </Badge>
                              </div>
                              {admission.reason && (
                                <p className="text-sm mt-2"><strong>Reason:</strong> {admission.reason}</p>
                              )}
                              <div className="mt-2 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                                {admission.notes && (
                                  <p className="text-sm rounded-md border bg-muted/40 px-2 py-1.5">{admission.notes}</p>
                                )}
                                {(admissionNotesByAdmission[admission.id] || []).map((note) => (
                                  <p
                                    key={note.id}
                                    className="text-sm rounded-md border bg-muted/40 px-2 py-1.5"
                                  >
                                    {note.note}
                                    <span className="block text-xs text-muted-foreground mt-1">
                                      {format(new Date(note.created_at), "MMM d, h:mm a")}
                                    </span>
                                  </p>
                                ))}
                                {canManageMedications && (
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <Textarea
                                      placeholder="Add a follow-up note..."
                                      value={newAdmissionNote[admission.id] || ""}
                                      onChange={(e) =>
                                        setNewAdmissionNote((prev) => ({
                                          ...prev,
                                          [admission.id]: e.target.value,
                                        }))
                                      }
                                      rows={2}
                                      className="text-sm"
                                    />
                                    <Button
                                      size="sm"
                                      className="shrink-0"
                                      onClick={() => handleAddAdmissionNote(admission.id)}
                                    >
                                      Add note
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleCheckout(admission.id)}
                              className="shrink-0"
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Check Out
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Available Entities Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Available {admissionType === 'camper' ? 'Campers' : 'Staff'}
                </h3>
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : admissionType === 'camper' ? (
                  filteredChildren.length === 0 ? (
                    <p className="text-muted-foreground">No children found</p>
                  ) : (
                    <div className="grid gap-2">
                      {filteredChildren
                        .filter(child => !admissions.some(a => a.child_id === child.id))
                        .map((child) => (
                          <div key={child.id} className="border rounded-lg p-3 flex items-center justify-between bg-card hover:bg-accent/50 transition-colors">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{child.name}</p>
                                {child.division?.name && (
                                  <Badge variant="outline" className="text-xs">
                                    {child.division.name}
                                  </Badge>
                                )}
                              </div>
                              {child.medical_notes && (
                                <p className="text-xs text-muted-foreground">{child.medical_notes}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = prompt("Reason for admission (optional):");
                                const notes = prompt("Additional notes (optional):");
                                if (reason !== null) {
                                  handleAdmit(child.id, 'child', reason || "", notes || "");
                                }
                              }}
                            >
                              <Hospital className="h-4 w-4 mr-2" />
                              Admit
                            </Button>
                          </div>
                        ))}
                    </div>
                  )
                ) : (
                  filteredStaff.length === 0 ? (
                    <p className="text-muted-foreground">No staff members found</p>
                  ) : (
                    <div className="grid gap-2">
                      {filteredStaff
                        .filter(member => !admissions.some(a => a.staff_id === member.id))
                        .map((member) => (
                          <div key={member.id} className="border rounded-lg p-3 flex items-center justify-between bg-card hover:bg-accent/50 transition-colors">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{member.name}</p>
                                {member.role && (
                                  <Badge variant="outline" className="text-xs">
                                    {member.role}
                                  </Badge>
                                )}
                              </div>
                              {member.allergies && (
                                <p className="text-xs text-destructive font-medium">⚠️ Allergies: {member.allergies}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const reason = prompt("Reason for admission (optional):");
                                const notes = prompt("Additional notes (optional):");
                                if (reason !== null) {
                                  handleAdmit(member.id, 'staff', reason || "", notes || "");
                                }
                              }}
                            >
                              <Hospital className="h-4 w-4 mr-2" />
                              Admit
                            </Button>
                          </div>
                        ))}
                    </div>
                  )
                )}
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Center Log Tab */}
        <TabsContent value="health-log">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>📊 Health Center Admission History</CardTitle>
                  <CardDescription>Past health center admissions this season</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.keys(groupedHistory).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No admission history found for this season</p>
                ) : (
                  <div className="grid gap-4">
                    {Object.values(groupedHistory).map((group: any) => {
                      const entity = group.child || group.staff;
                      const entityType = group.child ? 'Camper' : 'Staff';
                      const entityAdmissions = group.admissions;
                      const isExpanded = selectedChildForHistory === entity.id;
                      
                      return (
                        <Card key={entity.id} className="overflow-hidden">
                          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedChildForHistory(isExpanded ? null : entity.id)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-base">{entity.name}</CardTitle>
                                    <Badge variant={entityType === 'Camper' ? "outline" : "secondary"} className="text-xs">
                                      {entityType}
                                    </Badge>
                                    {entity.allergies && (
                                      <Badge variant="destructive" className="text-xs">
                                        ⚠️ Allergies
                                      </Badge>
                                    )}
                                  </div>
                                  <CardDescription className="text-sm">
                                    {group.child?.division?.name || entity.role || "No Division"}
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <Badge variant="secondary" className="mb-1">
                                    {entityAdmissions.length} {entityAdmissions.length === 1 ? 'admission' : 'admissions'}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground">
                                    Last: {format(new Date(entityAdmissions[0].admitted_at), "MMM d, h:mm a")}
                                  </p>
                                </div>
                                <Button variant="ghost" size="sm">
                                  {isExpanded ? "▲" : "▼"}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>

                          {isExpanded && (
                            <CardContent className="pt-0">
                              {entity.allergies && (
                                <div className="mb-3 p-2 bg-destructive/10 border border-destructive/20 rounded">
                                  <span className="font-medium text-destructive text-sm">⚠️ Allergies: </span>
                                  <span className="text-destructive text-sm">{entity.allergies}</span>
                                </div>
                              )}
                              <div className="space-y-3">
                                {entityAdmissions.map((admission: any, index: number) => (
                                  <div key={admission.id} className="border-l-2 border-primary/30 pl-4 py-2">
                                    <div className="flex items-start justify-between mb-2">
                                      <div>
                                        <p className="font-medium text-sm">
                                          Admission #{entityAdmissions.length - index}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {format(new Date(admission.admitted_at), "MMM d, yyyy • h:mm a")} - {format(new Date(admission.checked_out_at), "h:mm a")}
                                        </p>
                                      </div>
                                      <Badge variant="outline">
                                        {getAdmissionDuration(admission.admitted_at, admission.checked_out_at)}
                                      </Badge>
                                    </div>
                                    
                                    {admission.reason && (
                                      <div className="mb-2">
                                        <p className="text-xs font-medium text-muted-foreground">Reason:</p>
                                        <p className="text-sm">{admission.reason}</p>
                                      </div>
                                    )}
                                    
                                    <div className="mb-2 space-y-2">
                                      <p className="text-xs font-medium text-muted-foreground">Notes</p>
                                      {admission.notes && (
                                        <p className="text-sm rounded-md border bg-muted/40 px-2 py-1.5">
                                          {admission.notes}
                                        </p>
                                      )}
                                      {(admissionNotesByAdmission[admission.id] || []).map((note) => (
                                        <p
                                          key={note.id}
                                          className="text-sm rounded-md border bg-muted/40 px-2 py-1.5"
                                        >
                                          {note.note}
                                          <span className="block text-xs text-muted-foreground mt-1">
                                            {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                                          </span>
                                        </p>
                                      ))}
                                      {canManageMedications && (
                                        <div className="flex flex-col gap-2 sm:flex-row pt-1">
                                          <Textarea
                                            placeholder="Add another note..."
                                            value={newAdmissionNote[admission.id] || ""}
                                            onChange={(e) =>
                                              setNewAdmissionNote((prev) => ({
                                                ...prev,
                                                [admission.id]: e.target.value,
                                              }))
                                            }
                                            rows={2}
                                            className="text-sm"
                                          />
                                          <Button
                                            size="sm"
                                            className="shrink-0"
                                            onClick={() => handleAddAdmissionNote(admission.id)}
                                          >
                                            Add note
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                                      <span>
                                        Admitted by: Staff
                                      </span>
                                      <span>
                                        Checked out by: Staff
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                <CardTitle>Add Medication</CardTitle>
              </div>
              <CardDescription>Schedule medication for a child</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Child</Label>
                  <Select value={selectedChild} onValueChange={setSelectedChild}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a child" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredChildren.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                          {child.division?.name && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({child.division.name})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Medication Name</Label>
                  <Input
                    value={formData.medication_name}
                    onChange={(e) => setFormData({ ...formData, medication_name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Dosage</Label>
                  <Input
                    value={formData.dosage}
                    onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                    placeholder="e.g., 5ml, 1 tablet"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Meal Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[...STANDARD_MEAL_LABEL_ORDER, "Bedtime"].map((mealTime) => (
                      <div key={mealTime} className="flex items-center space-x-2">
                        <Checkbox
                          id={mealTime}
                          checked={formData.meal_times.includes(mealTime)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if (formData.meal_times.includes(mealTime)) return;
                              setFormData({
                                ...formData,
                                meal_times: [...formData.meal_times, mealTime],
                              });
                              return;
                            }
                            const meal_times = formData.meal_times.filter((t) => t !== mealTime);
                            setFormData({
                              ...formData,
                              meal_times,
                            });
                          }}
                        />
                        <Label
                          htmlFor={mealTime}
                          className="font-normal cursor-pointer text-sm"
                        >
                          {mealTime}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {formData.meal_times.includes("Bedtime") && (
                    <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                      {!selectedChild ? (
                        <p className="text-muted-foreground">Select a camper to see their bedtime (from roster division, US Eastern).</p>
                      ) : (
                        (() => {
                          const row = children.find((c) => c.id === selectedChild);
                          const divName = row?.division?.name;
                          const resolved = resolveBedtimeOptionFromDivisionName(divName);
                          if (!divName) {
                            return (
                              <p className="text-destructive">
                                This camper has no roster division — assign one before using Bedtime.
                              </p>
                            );
                          }
                          if (!resolved) {
                            return (
                              <p className="text-destructive">
                                No bedtime mapped for division &quot;{divName}&quot;. Update naming or bedtime rules.
                              </p>
                            );
                          }
                          return (
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                BEDTIME: <span className="font-normal">{resolved.mealTimeLabel}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Uses camper division ({divName}). Missed-dose alerts run after this time US Eastern (
                                America/New_York).
                              </p>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
                  />
                  <Label htmlFor="is_recurring" className="font-normal cursor-pointer">
                    Recurring medication
                  </Label>
                </div>

                {formData.is_recurring && (
                  <>
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={formData.frequency}
                        onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="custom">Custom Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.frequency === "custom" && (
                      <div className="space-y-2">
                        <Label>Days of Week</Label>
                        <div className="flex flex-wrap gap-2">
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                            <Button
                              key={day}
                              type="button"
                              size="sm"
                              variant={formData.days_of_week.includes(day) ? "default" : "outline"}
                              onClick={() => {
                                const days = formData.days_of_week.includes(day)
                                  ? formData.days_of_week.filter(d => d !== day)
                                  : [...formData.days_of_week, day];
                                setFormData({ ...formData, days_of_week: days });
                              }}
                            >
                              {day.slice(0, 3)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date (optional)</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Medication"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
        </>
      )}

      {/* Edit Medication Dialog */}
      <EditMedicationDialog
        medication={editingMedication}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={() => fetchMedications(selectedDate)}
      />

      <MedicationAdministrationPickerDialog
        open={!!medicationPicker}
        onOpenChange={(open) => {
          if (!open) setMedicationPicker(null);
        }}
        camperName={medicationPicker?.child.name ?? "Camper"}
        medications={medicationPicker?.medications ?? []}
        divisionName={medicationPicker?.child.division?.name}
        confirming={medicationPickerSubmitting}
        onConfirm={handleMedicationPickerConfirm}
      />

      <AlertDialog open={!!unadministerTarget} onOpenChange={(open) => !open && setUnadministerTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as not administered?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to undo this?{" "}
              {unadministerTarget?.medication_name
                ? `"${unadministerTarget.medication_name}" will be marked as pending again.`
                : "This medication will be marked as pending again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => unadministerTarget && handleUnadminister(unadministerTarget)}>
              Yes, undo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
