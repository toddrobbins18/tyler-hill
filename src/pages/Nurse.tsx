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
import { Pill, AlertCircle, CheckCircle2, Trash2, Calendar as CalendarIcon, LayoutList, Hospital, Clock, UserCheck, Search, ArrowUpDown, Users, Loader2, Scan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CSVUploader } from "@/components/CSVUploader";
import { JSONUploader } from "@/components/JSONUploader";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { sortDivisionsGirlsFirst } from "@/lib/divisionUtils";
import { usePermissions } from "@/hooks/usePermissions";

// Helper to check if we should show limited features for Timber Lake
const useTimberLakeMode = () => {
  const { currentCompany } = useCompany();
  return currentCompany?.slug === 'timber-lake-camp';
};

export default function Nurse() {
  const isTimberLake = useTimberLakeMode();
  const { currentSeason } = useSeasonContext();
  const { currentCompany } = useCompany();
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
  const [sortBy, setSortBy] = useState<'name' | 'division'>('name');
  const [rfidInput, setRfidInput] = useState("");
  const [scannedChild, setScannedChild] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();

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
    fetchChildren();
    fetchStaff();
    fetchDivisions();
    fetchMedications(selectedDate);
    fetchAdmissions();
    fetchAdmissionHistory();

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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, currentSeason]);

  const { getDivisionFilter } = usePermissions();

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
      .eq('company_id', currentCompany.id);

    if (error) {
      toast({ title: "Error fetching divisions", variant: "destructive" });
      return;
    }
    setDivisions(sortDivisionsGirlsFirst(data || []));
  };

  const fetchMedications = async (date?: Date) => {
    const dateStr = date ? format(date, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("medication_logs")
      .select("*, children(name), staff(name)")
      .eq("date", dateStr)
      .eq("season", currentSeason)
      .eq("company_id", currentCompany?.id || '')
      .order("meal_time");

    if (error) {
      toast({ title: "Error fetching medications", variant: "destructive" });
      return;
    }
    setMedications(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (!selectedChild) {
      toast({ title: "Please select a child", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (formData.meal_times.length === 0) {
      toast({ title: "Please select at least one meal time", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Create one medication log entry for each selected meal time
    const inserts = formData.meal_times.map(mealTime => ({
      child_id: selectedChild,
      date: today,
      medication_name: formData.medication_name,
      dosage: formData.dosage,
      meal_time: [mealTime],
      notes: formData.notes,
      is_recurring: formData.is_recurring,
      frequency: formData.frequency,
      days_of_week: formData.days_of_week,
      end_date: formData.end_date || null,
      company_id: currentCompany?.id,
      season: currentSeason,
    }));

    const { error } = await supabase.from("medication_logs").insert(inserts);

    if (error) {
      console.error("Medication insert error:", error);
      toast({ title: "Error adding medication", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    toast({ title: `Medication added successfully for ${formData.meal_times.length} time(s)` });
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

  const handleAdminister = async (medId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffData } = await supabase
      .from("staff")
      .select("id")
      .eq("email", user?.email)
      .single();

    const { error } = await supabase
      .from("medication_logs")
      .update({
        administered: true,
        administered_by: staffData?.id,
        administered_at: new Date().toISOString(),
      })
      .eq("id", medId);

    if (error) {
      toast({ title: "Error updating medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication marked as administered" });
    fetchMedications(selectedDate);
  };

  const handleRfidScan = async () => {
    if (!rfidInput.trim()) {
      toast({ 
        title: "Please enter or scan an RFID", 
        variant: "destructive" 
      });
      return;
    }

    setIsScanning(true);
    
    try {
      // Find child by RFID (with company and season filtering)
      const { data: child, error } = await supabase
        .from('children')
        .select('*, division:divisions(name)')
        .eq('rfid', rfidInput.trim())
        .eq('company_id', currentCompany?.id)
        .eq('season', currentSeason)
        .single();

      if (error || !child) {
        toast({
          title: "RFID Not Found",
          description: "No camper found with this RFID bracelet",
          variant: "destructive"
        });
        setRfidInput("");
        setIsScanning(false);
        return;
      }

      // Get current user (nurse/staff)
      const { data: { user } } = await supabase.auth.getUser();
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, name")
        .eq("email", user?.email)
        .single();

      // Find all unadministered medications for this child today
      const todayMeds = medications.filter(
        med => med.child_id === child.id && !med.administered
      );

      if (todayMeds.length === 0) {
        toast({
          title: "No Medications Pending",
          description: `${child.name} has no medications to administer today`,
        });
        setScannedChild(child);
        setRfidInput("");
        setIsScanning(false);
        return;
      }

      // Sort by scheduled_time and only take the FIRST medication
      const sortedMeds = todayMeds.sort((a, b) => {
        if (!a.scheduled_time) return 1;
        if (!b.scheduled_time) return -1;
        return a.scheduled_time.localeCompare(b.scheduled_time);
      });

      const nextMed = sortedMeds[0];

      // Administer only the FIRST/NEXT medication
      const { error: updateError } = await supabase
        .from("medication_logs")
        .update({
          administered: true,
          administered_by: staffData?.id,
          administered_at: new Date().toISOString(),
        })
        .eq("id", nextMed.id);

      if (updateError) {
        console.error('Error administering medication:', updateError);
        toast({
          title: "Error",
          description: "Failed to mark medication as administered",
          variant: "destructive"
        });
        setRfidInput("");
        setIsScanning(false);
        return;
      }

      // Success feedback with medication details
      const remainingCount = todayMeds.length - 1;
      toast({
        title: "✓ Medication Administered",
        description: `${nextMed.medication_name} marked as given for ${child.name}${remainingCount > 0 ? ` (${remainingCount} more pending)` : ''}`,
      });

      // Update UI
      setScannedChild(child);
      fetchMedications(selectedDate); // Refresh the list
      
      // Clear input for next scan
      setRfidInput("");
      
      // Auto-clear after 3 seconds
      setTimeout(() => setScannedChild(null), 3000);

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
    const { data, error } = await supabase
      .from("health_center_admissions")
      .select(`
        *,
        children!fk_health_center_admissions_child_id (
          id,
          name,
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
      .eq("season", currentSeason)
      .is("checked_out_at", null)
      .order("admitted_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching admissions", variant: "destructive" });
      return;
    }
    setAdmissions(data || []);
  };

  const fetchAdmissionHistory = async (childId?: string) => {
    let query = supabase
      .from("health_center_admissions")
      .select(`
        *,
        children!fk_health_center_admissions_child_id (
          id,
          name,
          division:division_id (
            name
          )
        )
      `)
      .eq("season", currentSeason)
      .not("checked_out_at", "is", null)
      .order("admitted_at", { ascending: false });

    if (childId) {
      query = query.eq("child_id", childId);
    }

    const { data, error } = await query;
    
    if (!error && data) {
      setAdmissionHistory(data);
    }
  };

  const handleAdmit = async (entityId: string, entityType: 'child' | 'staff', reason: string, notes: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const checkColumn = entityType === 'child' ? 'child_id' : 'staff_id';
    const { data: existing } = await supabase
      .from("health_center_admissions")
      .select("id")
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

    toast({ title: `${entityType === 'child' ? 'Child' : 'Staff member'} admitted to Health Center` });
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

    toast({ title: "Child checked out successfully" });
    fetchAdmissions();
    fetchAdmissionHistory();
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

  // Group admission history by child
  const groupedHistory = admissionHistory.reduce((acc: any, admission: any) => {
    const childId = admission.child_id;
    if (!acc[childId]) {
      acc[childId] = {
        child: admission.children,
        admissions: [],
      };
    }
    acc[childId].admissions.push(admission);
    return acc;
  }, {});

  const filteredChildren = children
    .filter(child => 
      child.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedDivision === "all" || child.division_id === selectedDivision)
    )
    .sort((a, b) => {
      if (sortBy === "division") {
        const divA = a.division?.sort_order || 999;
        const divB = b.division?.sort_order || 999;
        if (divA !== divB) return divA - divB;
      }
      return a.name.localeCompare(b.name);
    });

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
          <JSONUploader tableName="medication_logs" onUploadComplete={() => fetchMedications(selectedDate)} />
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
              ) : medications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for this date</p>
              ) : (
                <div className="space-y-4">
                  {filteredChildren
                    .filter(child => medications.some(med => med.child_id === child.id))
                    .map((child) => {
                      const childMeds = medications.filter(med => med.child_id === child.id);
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
                          {childMeds.map((med) => {
                            const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
                            return (
                              <div key={med.id} className="p-3 bg-muted/50 rounded space-y-2">
                                <div className="flex items-start gap-3">
                                  {!isPastDate && (
                                    <Checkbox
                                      checked={med.administered}
                                      onCheckedChange={() => !med.administered && handleAdminister(med.id)}
                                      disabled={med.administered}
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{med.medication_name}</span>
                                      {med.administered && (
                                        <Badge variant="outline" className="flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Given
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {med.dosage} - {med.meal_time}
                                    </p>
                                    {med.notes && (
                                      <p className="text-sm text-muted-foreground mt-1">{med.notes}</p>
                                    )}
                                  </div>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="log">Daily Log</TabsTrigger>
          <TabsTrigger value="today">Today's Medications</TabsTrigger>
          <TabsTrigger value="health-center">Health Center</TabsTrigger>
          <TabsTrigger value="health-log">Health Center Log</TabsTrigger>
          <TabsTrigger value="add">Add Medication</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle>Daily Medication Log</CardTitle>
              <CardDescription>Mark off medications administered today</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : medications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for today</p>
              ) : (
                <div className="space-y-4">
                  {filteredChildren
                    .filter(child => medications.some(med => med.child_id === child.id))
                    .map((child) => {
                      const childMeds = medications.filter(med => med.child_id === child.id);
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
                              <div key={med.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded">
                                <Checkbox
                                  checked={med.administered}
                                  onCheckedChange={() => !med.administered && handleAdminister(med.id)}
                                  disabled={med.administered}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{med.medication_name}</span>
                                    {med.administered && (
                                      <Badge variant="outline" className="flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Given
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {med.dosage} - {med.meal_time}
                                  </p>
                                  {med.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">{med.notes}</p>
                                  )}
                                  {med.administered && med.staff?.name && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      By {med.staff.name}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(med.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
              <CardTitle>Today's Medications</CardTitle>
              <CardDescription>Track medication administration</CardDescription>
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
                    Scan camper's RFID bracelet to automatically administer their medications
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
              ) : medications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for today</p>
              ) : (
                <div className="space-y-3">
                  {medications.map((med) => (
                    <div
                      key={med.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{med.children?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {med.medication_name} - {med.dosage}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {med.meal_time}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {med.administered ? (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Given
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-warning" />
                              Pending
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(med.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {!med.administered && (
                        <Button
                          size="sm"
                          onClick={() => handleAdminister(med.id)}
                          className="w-full mt-2"
                        >
                          Mark as Administered
                        </Button>
                      )}
                      {med.administered && med.staff?.name && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Administered by {med.staff.name}
                        </p>
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
              {/* Search Bar */}
              <div className="space-y-2">
                <Label>Search Children</Label>
                <Input
                  placeholder="Search by name..."
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
                              {admission.notes && (
                                <p className="text-sm text-muted-foreground mt-1">{admission.notes}</p>
                              )}
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

              {/* Available Children Section */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Available Children
                </h3>
                {loading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : filteredChildren.length === 0 ? (
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
                                    
                                    {admission.notes && (
                                      <div className="mb-2">
                                        <p className="text-xs font-medium text-muted-foreground">Notes:</p>
                                        <p className="text-sm">{admission.notes}</p>
                                      </div>
                                    )}
                                    
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
                    {[
                      "Before Breakfast",
                      "After Breakfast", 
                      "Before Lunch",
                      "After Lunch",
                      "Before Dinner",
                      "After Dinner",
                      "Bedtime"
                    ].map((mealTime) => (
                      <div key={mealTime} className="flex items-center space-x-2">
                        <Checkbox
                          id={mealTime}
                          checked={formData.meal_times.includes(mealTime)}
                          onCheckedChange={(checked) => {
                            const newTimes = checked
                              ? [...formData.meal_times, mealTime]
                              : formData.meal_times.filter(t => t !== mealTime);
                            setFormData({ ...formData, meal_times: newTimes });
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
    </div>
  );
}
