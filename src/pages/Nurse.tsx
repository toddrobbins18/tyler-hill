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
import { Pill, AlertCircle, CheckCircle2, Trash2, Calendar as CalendarIcon, LayoutList, Hospital, Clock, UserCheck, Search, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CSVUploader } from "@/components/CSVUploader";
import { JSONUploader } from "@/components/JSONUploader";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { useSeasonContext } from "@/contexts/SeasonContext";

export default function Nurse() {
  const { currentSeason } = useSeasonContext();
  const [children, setChildren] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [admissionHistory, setAdmissionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [selectedChildForHistory, setSelectedChildForHistory] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("all");
  const [sortBy, setSortBy] = useState<'name' | 'division'>('name');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    medication_name: "",
    dosage: "",
    meal_time: "Before Breakfast",
    notes: "",
    is_recurring: false,
    frequency: "daily",
    days_of_week: [] as string[],
    end_date: "",
  });

  useEffect(() => {
    fetchChildren();
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

  const fetchChildren = async () => {
    const { data, error } = await supabase
      .from("children")
      .select(`
        *,
        division:divisions(id, name, gender, sort_order)
      `)
      .eq("status", "active")
      .order("name");

    if (error) {
      toast({ title: "Error fetching children", variant: "destructive" });
      return;
    }
    setChildren(data || []);
    setLoading(false);
  };

  const fetchDivisions = async () => {
    const { data, error } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");

    if (error) {
      toast({ title: "Error fetching divisions", variant: "destructive" });
      return;
    }
    setDivisions(data || []);
  };

  const fetchMedications = async (date?: Date) => {
    const dateStr = date ? format(date, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("medication_logs")
      .select("*, children(name), staff(name)")
      .eq("date", dateStr)
      .eq("season", currentSeason)
      .order("meal_time");

    if (error) {
      toast({ title: "Error fetching medications", variant: "destructive" });
      return;
    }
    setMedications(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) {
      toast({ title: "Please select a child", variant: "destructive" });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from("medication_logs").insert({
      child_id: selectedChild,
      date: today,
      medication_name: formData.medication_name,
      dosage: formData.dosage,
      meal_time: formData.meal_time,
      notes: formData.notes,
      is_recurring: formData.is_recurring,
      frequency: formData.frequency,
      days_of_week: formData.days_of_week,
      end_date: formData.end_date || null,
    });

    if (error) {
      console.error("Medication insert error:", error);
      toast({ title: "Error adding medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication added successfully" });
    setFormData({ 
      medication_name: "", 
      dosage: "", 
      meal_time: "Before Breakfast", 
      notes: "",
      is_recurring: false,
      frequency: "daily",
      days_of_week: [],
      end_date: "",
    });
    setSelectedChild("");
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
        children:child_id (
          id,
          name,
          division:division_id (
            name
          )
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
        children:child_id (
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

  const handleAdmit = async (childId: string, reason: string, notes: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Check if child is already admitted
    const { data: existing } = await supabase
      .from("health_center_admissions")
      .select("id")
      .eq("child_id", childId)
      .is("checked_out_at", null)
      .maybeSingle();

    if (existing) {
      toast({ title: "Child is already admitted", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("health_center_admissions")
      .insert({
        child_id: childId,
        admitted_by: user?.id,
        reason,
        notes,
        season: currentSeason,
      });

    if (error) {
      toast({ title: "Error admitting child", variant: "destructive" });
      return;
    }

    toast({ title: "Child admitted to Health Center" });
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="log">Daily Log</TabsTrigger>
          <TabsTrigger value="today">Today's Medications</TabsTrigger>
          <TabsTrigger value="health-center">Health Center</TabsTrigger>
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
                    {admissions.map((admission) => (
                      <div key={admission.id} className="border rounded-lg p-4 bg-destructive/5">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg">{admission.children?.name}</h4>
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
                    ))}
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
                                handleAdmit(child.id, reason || "", notes || "");
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

              {/* Admission History Section */}
              <div className="mt-8 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">📊 Admission History</h3>
                    <p className="text-sm text-muted-foreground">Past health center admissions this season</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    {showHistory ? "Hide History" : "View Past Admissions"}
                  </Button>
                </div>

                {showHistory && (
                  <div className="space-y-4">
                    {Object.keys(groupedHistory).length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No admission history found for this season</p>
                    ) : (
                      <div className="grid gap-4">
                        {Object.values(groupedHistory).map((group: any) => {
                          const child = group.child;
                          const childAdmissions = group.admissions;
                          const isExpanded = selectedChildForHistory === child.id;
                          
                          return (
                            <Card key={child.id} className="overflow-hidden">
                              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedChildForHistory(isExpanded ? null : child.id)}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <CardTitle className="text-base">{child.name}</CardTitle>
                                      <CardDescription className="text-sm">
                                        {child.division?.name || "No Division"}
                                      </CardDescription>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="text-right">
                                      <Badge variant="secondary" className="mb-1">
                                        {childAdmissions.length} {childAdmissions.length === 1 ? 'admission' : 'admissions'}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground">
                                        Last: {format(new Date(childAdmissions[0].admitted_at), "MMM d, h:mm a")}
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
                                  <div className="space-y-3">
                                    {childAdmissions.map((admission: any, index: number) => (
                                      <div key={admission.id} className="border-l-2 border-primary/30 pl-4 py-2">
                                        <div className="flex items-start justify-between mb-2">
                                          <div>
                                            <p className="font-medium text-sm">
                                              Admission #{childAdmissions.length - index}
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
                                            Admitted by: {admission.admitted_by_staff?.name || "Unknown"}
                                          </span>
                                          <span>
                                            Checked out by: {admission.checked_out_by_staff?.name || "Unknown"}
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
                          checked={formData.meal_time === mealTime}
                          onCheckedChange={() => setFormData({ ...formData, meal_time: mealTime })}
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

                <Button type="submit" className="w-full">Add Medication</Button>
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
