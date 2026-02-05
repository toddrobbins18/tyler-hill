import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Plus, Search, Edit2, Trash2, Clock, User, MapPin, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import SearchableChildSelect from "@/components/SearchableChildSelect";

const APPOINTMENT_TYPES = [
  "Orthodontist",
  "Physical Therapy",
  "Dentist",
  "Optometrist",
  "General Physician",
  "Specialist",
  "Mental Health",
  "Tooth Fairy",
  "Other"
];

const APPOINTMENT_STATUS = [
  { value: "scheduled", label: "Scheduled", variant: "default" as const },
  { value: "completed", label: "Completed", variant: "secondary" as const },
  { value: "cancelled", label: "Cancelled", variant: "destructive" as const },
  { value: "no_show", label: "No Show", variant: "outline" as const }
];

interface Child {
  id: string;
  name: string;
  division_id: string | null;
}

interface Staff {
  id: string;
  name: string;
  department: string | null;
}

interface Appointment {
  id: string;
  child_id: string | null;
  staff_id: string | null;
  appointment_type: string;
  appointment_date: string;
  appointment_time: string | null;
  provider_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  outcome: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  child?: Child;
  staff?: Staff;
}

export default function Appointments() {
  const { currentCompany } = useCompany();
  const { selectedSeason: currentSeason } = useSeason();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("upcoming");
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // Form state
  const [personType, setPersonType] = useState<"child" | "staff">("child");
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [appointmentType, setAppointmentType] = useState<string>("");
  const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(undefined);
  const [appointmentTime, setAppointmentTime] = useState<string>("");
  const [providerName, setProviderName] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<string>("scheduled");
  const [outcome, setOutcome] = useState<string>("");
  const [followUpRequired, setFollowUpRequired] = useState<boolean>(false);
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(undefined);

  // Check if this is Tyler Hill Camp
  // Appointments are available for Tyler Hill, Timber Lake, Timber Lake West, and Trails End
  const allowedCamps = ['tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west', 'trails-end-camp'];
  const isAllowedCamp = currentCompany?.slug && allowedCamps.includes(currentCompany.slug);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchData();
    }
  }, [currentCompany?.id, currentSeason]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      const [appointmentsRes, childrenRes, staffRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            *,
            child:child_id(id, name, division_id),
            staff:staff_id(id, name, department)
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .order("appointment_date", { ascending: true }),
        supabase
          .from("children")
          .select("id, name, division_id")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .order("name"),
        supabase
          .from("staff")
          .select("id, name, department")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .order("name")
      ]);

      if (appointmentsRes.data) setAppointments(appointmentsRes.data as unknown as Appointment[]);
      if (childrenRes.data) setChildren(childrenRes.data);
      if (staffRes.data) setStaff(staffRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPersonType("child");
    setSelectedChildId("");
    setSelectedStaffId("");
    setAppointmentType("");
    setAppointmentDate(undefined);
    setAppointmentTime("");
    setProviderName("");
    setLocation("");
    setNotes("");
    setStatus("scheduled");
    setOutcome("");
    setFollowUpRequired(false);
    setFollowUpDate(undefined);
    setEditingAppointment(null);
  };

  const openAddDialog = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEditDialog = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setPersonType(appointment.child_id ? "child" : "staff");
    setSelectedChildId(appointment.child_id || "");
    setSelectedStaffId(appointment.staff_id || "");
    setAppointmentType(appointment.appointment_type);
    setAppointmentDate(appointment.appointment_date ? new Date(appointment.appointment_date) : undefined);
    setAppointmentTime(appointment.appointment_time || "");
    setProviderName(appointment.provider_name || "");
    setLocation(appointment.location || "");
    setNotes(appointment.notes || "");
    setStatus(appointment.status);
    setOutcome(appointment.outcome || "");
    setFollowUpRequired(appointment.follow_up_required);
    setFollowUpDate(appointment.follow_up_date ? new Date(appointment.follow_up_date) : undefined);
    setShowDialog(true);
  };

  const handleSaveAppointment = async () => {
    if (!currentCompany?.id || !appointmentType || !appointmentDate) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    if (personType === "child" && !selectedChildId) {
      toast({ title: "Please select a camper", variant: "destructive" });
      return;
    }

    if (personType === "staff" && !selectedStaffId) {
      toast({ title: "Please select a staff member", variant: "destructive" });
      return;
    }

    try {
      const appointmentData = {
        company_id: currentCompany.id,
        child_id: personType === "child" ? selectedChildId : null,
        staff_id: personType === "staff" ? selectedStaffId : null,
        appointment_type: appointmentType,
        appointment_date: format(appointmentDate, "yyyy-MM-dd"),
        appointment_time: appointmentTime || null,
        provider_name: providerName || null,
        location: location || null,
        notes: notes || null,
        status,
        outcome: outcome || null,
        follow_up_required: followUpRequired,
        follow_up_date: followUpDate ? format(followUpDate, "yyyy-MM-dd") : null,
        season: currentSeason
      };

      if (editingAppointment) {
        const { error } = await supabase
          .from("appointments")
          .update(appointmentData)
          .eq("id", editingAppointment.id);

        if (error) throw error;
        
        // Send update notification
        await supabase.functions.invoke('send-appointment-notification', {
          body: { appointment_id: editingAppointment.id, action: 'update' }
        });
        
        toast({ title: "Appointment updated successfully" });
      } else {
        const { data: newAppointment, error } = await supabase
          .from("appointments")
          .insert(appointmentData)
          .select()
          .single();

        if (error) throw error;
        
        // Send create notification
        if (newAppointment) {
          await supabase.functions.invoke('send-appointment-notification', {
            body: { appointment_id: newAppointment.id, action: 'create' }
          });
        }
        
        toast({ title: "Appointment created successfully" });
      }

      setShowDialog(false);
      resetForm();
      await fetchData();
    } catch (error) {
      console.error("Error saving appointment:", error);
      toast({ title: "Error saving appointment", variant: "destructive" });
    }
  };

  const handleDeleteAppointment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;

    try {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Appointment deleted successfully" });
      await fetchData();
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast({ title: "Error deleting appointment", variant: "destructive" });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const found = APPOINTMENT_STATUS.find(s => s.value === status);
    return found?.variant || "default";
  };

  const filteredAppointments = appointments.filter(apt => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const aptDate = new Date(apt.appointment_date + 'T00:00:00');

    // Tab filter
    if (activeTab === "upcoming" && aptDate < today) return false;
    if (activeTab === "past" && aptDate >= today) return false;

    // Search filter
    const personName = apt.child?.name || apt.staff?.name || "";
    if (searchTerm && !personName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !apt.appointment_type.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !apt.provider_name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Type filter
    if (filterType !== "all" && apt.appointment_type !== filterType) return false;

    // Status filter
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;

    return true;
  });

  if (!isAllowedCamp) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Appointments</h1>
          <p className="text-muted-foreground">This feature is not available for your camp.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">
            Manage medical and therapy appointments for campers and staff
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Appointment
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <CardTitle>Appointments</CardTitle>
                  <CardDescription>
                    {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''} found
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {APPOINTMENT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {APPOINTMENT_STATUS.map(status => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                      <TableHead>Date</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {format(new Date(apt.appointment_date + 'T00:00:00'), "MMM d, yyyy")}
                            </span>
                            {apt.appointment_time && (
                              <span className="text-sm text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {apt.appointment_time}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{apt.child?.name || apt.staff?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {apt.child_id ? "Camper" : "Staff"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-muted-foreground" />
                            {apt.appointment_type}
                          </div>
                        </TableCell>
                        <TableCell>
                          {apt.provider_name && (
                            <div className="flex flex-col">
                              <span>{apt.provider_name}</span>
                              {apt.location && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {apt.location}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(apt.status)}>
                            {apt.status}
                          </Badge>
                          {apt.follow_up_required && (
                            <Badge variant="outline" className="ml-1">
                              Follow-up
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(apt)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAppointment(apt.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAppointments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No appointments found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Appointment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAppointment ? "Edit Appointment" : "Add Appointment"}
            </DialogTitle>
            <DialogDescription>
              {editingAppointment 
                ? "Update the appointment details" 
                : "Schedule a new appointment for a camper or staff member"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Person Type Selection */}
            <div className="space-y-2">
              <Label>Appointment For</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={personType === "child" ? "default" : "outline"}
                  onClick={() => setPersonType("child")}
                >
                  Camper
                </Button>
                <Button
                  type="button"
                  variant={personType === "staff" ? "default" : "outline"}
                  onClick={() => setPersonType("staff")}
                >
                  Staff
                </Button>
              </div>
            </div>

            {/* Person Selection */}
            {personType === "child" ? (
              <div className="space-y-2">
                <Label>Select Camper *</Label>
                <SearchableChildSelect
                  value={selectedChildId}
                  onValueChange={setSelectedChildId}
                  children={children}
                  placeholder="Search campers..."
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Staff Member *</Label>
                <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Appointment Type */}
              <div className="space-y-2">
                <Label>Appointment Type *</Label>
                <Select value={appointmentType} onValueChange={setAppointmentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !appointmentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {appointmentDate ? format(appointmentDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={appointmentDate}
                      onSelect={setAppointmentDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Time */}
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUS.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Provider */}
              <div className="space-y-2">
                <Label>Provider Name</Label>
                <Input
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="Dr. Smith"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="123 Medical Center"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            {/* Outcome (for editing completed appointments) */}
            {editingAppointment && (
              <div className="space-y-2">
                <Label>Outcome</Label>
                <Textarea
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Appointment outcome..."
                  rows={2}
                />
              </div>
            )}

            {/* Follow-up */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="follow-up"
                  checked={followUpRequired}
                  onChange={(e) => setFollowUpRequired(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="follow-up">Follow-up Required</Label>
              </div>
              {followUpRequired && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(!followUpDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {followUpDate ? format(followUpDate, "PP") : "Follow-up date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={followUpDate}
                      onSelect={setFollowUpDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAppointment}>
              {editingAppointment ? "Save Changes" : "Create Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
