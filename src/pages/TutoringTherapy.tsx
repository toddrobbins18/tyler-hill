import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Plus, Pencil, Trash2, Search, X, List, CalendarRange, Filter } from "lucide-react";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";

const locales = { "en-US": require("date-fns/locale/en-US") };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface Enrollment {
  id: string;
  child_id: string;
  service_type: string;
  instructor: string | null;
  schedule_periods: string[];
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  season: string;
  children?: { name: string; division_id: string; gender: string };
}

interface Child {
  id: string;
  name: string;
  division_id: string;
  gender: string;
}

interface Division {
  id: string;
  name: string;
  gender: string;
}

const TutoringTherapy = () => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterService, setFilterService] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  const [formData, setFormData] = useState({
    child_id: "",
    service_type: "",
    instructor: "",
    schedule_periods: [] as string[],
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    notes: "",
  });

  useEffect(() => {
    fetchEnrollments();
    fetchChildren();
    fetchDivisions();

    const channel = supabase
      .channel("tutoring_therapy_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tutoring_therapy" }, () => {
        fetchEnrollments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from("tutoring_therapy")
        .select(`
          *,
          children (
            name,
            division_id,
            gender
          )
        `)
        .order("service_type");

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error("Error fetching enrollments:", error);
      toast.error("Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  };

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase.from("children").select("*").order("name");
      if (error) throw error;
      setChildren(data || []);
    } catch (error) {
      console.error("Error fetching children:", error);
    }
  };

  const fetchDivisions = async () => {
    try {
      const { data, error } = await supabase.from("divisions").select("*").order("sort_order");
      if (error) throw error;
      setDivisions(data || []);
    } catch (error) {
      console.error("Error fetching divisions:", error);
    }
  };

  const periodOptions = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

  const servicesList = [
    "Math Tutoring",
    "Reading Tutoring",
    "Science Tutoring",
    "Speech Therapy",
    "Occupational Therapy",
    "Physical Therapy",
    "Behavioral Therapy",
    "Music Therapy",
    "Art Therapy",
    "ESL Tutoring",
  ];

  const serviceColors: Record<string, string> = {
    "Math Tutoring": "bg-blue-100 text-blue-800 border-blue-200",
    "Reading Tutoring": "bg-purple-100 text-purple-800 border-purple-200",
    "Science Tutoring": "bg-green-100 text-green-800 border-green-200",
    "Speech Therapy": "bg-pink-100 text-pink-800 border-pink-200",
    "Occupational Therapy": "bg-orange-100 text-orange-800 border-orange-200",
    "Physical Therapy": "bg-teal-100 text-teal-800 border-teal-200",
    "Behavioral Therapy": "bg-indigo-100 text-indigo-800 border-indigo-200",
    "Music Therapy": "bg-yellow-100 text-yellow-800 border-yellow-200",
    "Art Therapy": "bg-red-100 text-red-800 border-red-200",
    "ESL Tutoring": "bg-cyan-100 text-cyan-800 border-cyan-200",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const enrollmentData = {
        child_id: formData.child_id,
        service_type: formData.service_type,
        instructor: formData.instructor || null,
        schedule_periods: formData.schedule_periods,
        start_date: formData.start_date ? format(formData.start_date, "yyyy-MM-dd") : null,
        end_date: formData.end_date ? format(formData.end_date, "yyyy-MM-dd") : null,
        notes: formData.notes || null,
      };

      if (editingEnrollment) {
        const { error } = await supabase
          .from("tutoring_therapy")
          .update(enrollmentData)
          .eq("id", editingEnrollment.id);

        if (error) throw error;
        toast.success("Enrollment updated successfully");
      } else {
        const { error } = await supabase.from("tutoring_therapy").insert([enrollmentData]);

        if (error) throw error;
        toast.success("Enrollment created successfully");
      }

      resetForm();
    } catch (error) {
      console.error("Error saving enrollment:", error);
      toast.error("Failed to save enrollment");
    }
  };

  const resetForm = () => {
    setFormData({
      child_id: "",
      service_type: "",
      instructor: "",
      schedule_periods: [],
      start_date: undefined,
      end_date: undefined,
      notes: "",
    });
    setEditingEnrollment(null);
    setDialogOpen(false);
  };

  const handleEdit = (enrollment: Enrollment) => {
    setFormData({
      child_id: enrollment.child_id,
      service_type: enrollment.service_type,
      instructor: enrollment.instructor || "",
      schedule_periods: enrollment.schedule_periods || [],
      start_date: enrollment.start_date ? new Date(enrollment.start_date) : undefined,
      end_date: enrollment.end_date ? new Date(enrollment.end_date) : undefined,
      notes: enrollment.notes || "",
    });
    setEditingEnrollment(enrollment);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("tutoring_therapy").delete().eq("id", id);

      if (error) throw error;
      toast.success("Enrollment deleted successfully");
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting enrollment:", error);
      toast.error("Failed to delete enrollment");
    }
  };

  const toggleSchedulePeriod = (period: string) => {
    setFormData((prev) => ({
      ...prev,
      schedule_periods: prev.schedule_periods.includes(period)
        ? prev.schedule_periods.filter((p) => p !== period)
        : [...prev.schedule_periods, period],
    }));
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const child = children.find((c) => c.id === enrollment.child_id);
    if (!child) return false;

    const matchesDivision = filterDivision === "all" || child.division_id === filterDivision;
    const matchesGender = filterGender === "all" || child.gender === filterGender;
    const matchesService = filterService === "all" || enrollment.service_type === filterService;
    const matchesSearch =
      searchTerm === "" ||
      child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      enrollment.service_type.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesDivision && matchesGender && matchesService && matchesSearch;
  });

  const uniqueServices = Array.from(new Set(enrollments.map((e) => e.service_type))).sort();

  const groupedByService = filteredEnrollments.reduce((acc, enrollment) => {
    const service = enrollment.service_type;
    if (!acc[service]) {
      acc[service] = [];
    }
    acc[service].push(enrollment);
    return acc;
  }, {} as Record<string, Enrollment[]>);

  const getDaysWithActivities = () => {
    const daysSet = new Set<string>();
    filteredEnrollments.forEach((enrollment) => {
      if (enrollment.start_date && enrollment.end_date) {
        const start = new Date(enrollment.start_date);
        const end = new Date(enrollment.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          daysSet.add(format(d, "yyyy-MM-dd"));
        }
      }
    });
    return Array.from(daysSet).map((dateStr) => new Date(dateStr));
  };

  const getActivitiesForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return filteredEnrollments.filter((enrollment) => {
      if (!enrollment.start_date || !enrollment.end_date) return false;
      const start = format(new Date(enrollment.start_date), "yyyy-MM-dd");
      const end = format(new Date(enrollment.end_date), "yyyy-MM-dd");
      return dateStr >= start && dateStr <= end;
    });
  };

  const activeFilterCount =
    (filterDivision !== "all" ? 1 : 0) +
    (filterGender !== "all" ? 1 : 0) +
    (filterService !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setFilterDivision("all");
    setFilterGender("all");
    setFilterService("all");
    setSearchTerm("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tutoring & Therapy</h1>
          <p className="text-muted-foreground">Manage tutoring and therapy enrollments</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarRange className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingEnrollment(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Enrollment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingEnrollment ? "Edit Enrollment" : "Add New Enrollment"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="child_id">Camper *</Label>
                  <Select
                    value={formData.child_id}
                    onValueChange={(value) => setFormData({ ...formData, child_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select camper" />
                    </SelectTrigger>
                    <SelectContent>
                      {children.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service_type">Service Type *</Label>
                  <Select
                    value={formData.service_type}
                    onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicesList.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructor">Instructor/Therapist</Label>
                  <Input
                    id="instructor"
                    value={formData.instructor}
                    onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                    placeholder="Enter instructor/therapist name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Schedule Periods</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {periodOptions.map((period) => (
                      <Button
                        key={period}
                        type="button"
                        variant={formData.schedule_periods.includes(period) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleSchedulePeriod(period)}
                      >
                        {period}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.start_date ? format(formData.start_date, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.start_date}
                          onSelect={(date) => setFormData({ ...formData, start_date: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.end_date ? format(formData.end_date, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={formData.end_date}
                          onSelect={(date) => setFormData({ ...formData, end_date: date })}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingEnrollment ? "Update" : "Create"} Enrollment
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
              {activeFilterCount > 0 && (
                <Badge variant="secondary">{activeFilterCount} active</Badge>
              )}
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campers or services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Division</Label>
              <Select value={filterDivision} onValueChange={setFilterDivision}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="Boys">Boys</SelectItem>
                  <SelectItem value="Girls">Girls</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={filterService} onValueChange={setFilterService}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {uniqueServices.map((service) => (
                    <SelectItem key={service} value={service}>
                      {service}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6">
            <BigCalendar
              localizer={localizer}
              events={[]}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              views={["month"]}
              defaultView="month"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByService).map(([service, serviceEnrollments]) => (
            <Card key={service}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={serviceColors[service] || "bg-gray-100 text-gray-800"}>
                      {service}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {serviceEnrollments.length} {serviceEnrollments.length === 1 ? "enrollment" : "enrollments"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {serviceEnrollments.map((enrollment) => {
                    const child = children.find((c) => c.id === enrollment.child_id);
                    return (
                      <Card key={enrollment.id} className="border-2">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{child?.name}</h4>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(enrollment)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(enrollment.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {enrollment.instructor && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Instructor: </span>
                              {enrollment.instructor}
                            </div>
                          )}

                          {enrollment.schedule_periods && enrollment.schedule_periods.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {enrollment.schedule_periods.map((period) => (
                                <Badge key={period} variant="outline" className="text-xs">
                                  {period}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {(enrollment.start_date || enrollment.end_date) && (
                            <div className="text-sm text-muted-foreground">
                              {enrollment.start_date && format(new Date(enrollment.start_date), "MMM d")}
                              {enrollment.start_date && enrollment.end_date && " - "}
                              {enrollment.end_date && format(new Date(enrollment.end_date), "MMM d, yyyy")}
                            </div>
                          )}

                          {enrollment.notes && (
                            <p className="text-sm text-muted-foreground italic">{enrollment.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Enrollment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this enrollment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && handleDelete(deletingId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TutoringTherapy;
