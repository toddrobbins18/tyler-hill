import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Plus, Pencil, Trash2, User, Calendar as CalendarIcon, LayoutList, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

export default function SportsAcademy() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState({
    child_id: "",
    sport_name: "",
    instructor: "",
    schedule_periods: [] as string[],
    period_number: "",
    other_period: "",
    start_date: "",
    end_date: "",
    notes: "",
  });
  const { toast } = useToast();

  const periodOptions = ["Rest Hour", "Shower Hour", "Free Play", "Period #", "Other"];
  const sportsList = ["Baseball", "Basketball", "Dance", "Football", "Golf", "Gymnastics", "Hockey", "Lacrosse", "Soccer", "Softball", "Tennis", "Volleyball", "Waterfront"];
  
  const sportColors: Record<string, string> = {
    Baseball: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    Basketball: "bg-orange-500/20 text-orange-700 border-orange-500/30",
    Dance: "bg-pink-500/20 text-pink-700 border-pink-500/30",
    Football: "bg-green-500/20 text-green-700 border-green-500/30",
    Golf: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
    Gymnastics: "bg-purple-500/20 text-purple-700 border-purple-500/30",
    Hockey: "bg-cyan-500/20 text-cyan-700 border-cyan-500/30",
    Lacrosse: "bg-indigo-500/20 text-indigo-700 border-indigo-500/30",
    Soccer: "bg-lime-500/20 text-lime-700 border-lime-500/30",
    Softball: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
    Tennis: "bg-teal-500/20 text-teal-700 border-teal-500/30",
    Volleyball: "bg-rose-500/20 text-rose-700 border-rose-500/30",
    Waterfront: "bg-sky-500/20 text-sky-700 border-sky-500/30",
  };

  useEffect(() => {
    fetchEnrollments();
    fetchChildren();
    fetchDivisions();

    const channel = supabase
      .channel('sports-academy-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sports_academy' },
        () => fetchEnrollments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEnrollments = async () => {
    const { data, error } = await supabase
      .from("sports_academy")
      .select(`
        *,
        child:children(id, name, age, gender, division_id, division:divisions(id, name, gender))
      `)
      .order("sport_name", { ascending: true });

    if (error) {
      toast({ title: "Error fetching enrollments", variant: "destructive" });
      setLoading(false);
      return;
    }
    setEnrollments(data || []);
    setLoading(false);
  };

  const fetchChildren = async () => {
    const { data } = await supabase
      .from("children")
      .select("id, name, age, gender, division_id")
      .eq("status", "active")
      .order("name");
    
    if (data) {
      setChildren(data);
    }
  };

  const fetchDivisions = async () => {
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");
    
    if (data) {
      setDivisions(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Build schedule_periods array
    const periods: string[] = [];
    formData.schedule_periods.forEach(period => {
      if (period === "Period #" && formData.period_number) {
        periods.push(`Period ${formData.period_number}`);
      } else if (period === "Other" && formData.other_period) {
        periods.push(formData.other_period);
      } else if (period !== "Period #" && period !== "Other") {
        periods.push(period);
      }
    });

    const submitData = {
      child_id: formData.child_id,
      sport_name: formData.sport_name,
      instructor: formData.instructor,
      schedule_periods: periods.length > 0 ? periods : null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      notes: formData.notes || null,
    };

    if (editingEnrollment) {
      const { error } = await supabase
        .from("sports_academy")
        .update(submitData)
        .eq("id", editingEnrollment.id);

      if (error) {
        toast({ title: "Error updating enrollment", variant: "destructive" });
        return;
      }
      toast({ title: "Enrollment updated successfully" });
    } else {
      const { error } = await supabase
        .from("sports_academy")
        .insert(submitData);

      if (error) {
        toast({ title: "Error adding enrollment", variant: "destructive" });
        return;
      }
      toast({ title: "Enrollment added successfully" });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      child_id: "",
      sport_name: "",
      instructor: "",
      schedule_periods: [],
      period_number: "",
      other_period: "",
      start_date: "",
      end_date: "",
      notes: "",
    });
    setEditingEnrollment(null);
    setShowDialog(false);
    fetchEnrollments();
  };

  const handleEdit = (enrollment: any) => {
    setEditingEnrollment(enrollment);
    
    // Parse schedule_periods back into form state
    const periods = enrollment.schedule_periods || [];
    const basePeriods: string[] = [];
    let periodNum = "";
    let otherText = "";
    
    periods.forEach((period: string) => {
      if (period.startsWith("Period ")) {
        basePeriods.push("Period #");
        periodNum = period.replace("Period ", "");
      } else if (!["Rest Hour", "Shower Hour", "Free Play"].includes(period)) {
        basePeriods.push("Other");
        otherText = period;
      } else {
        basePeriods.push(period);
      }
    });

    setFormData({
      child_id: enrollment.child_id,
      sport_name: enrollment.sport_name,
      instructor: enrollment.instructor || "",
      schedule_periods: basePeriods,
      period_number: periodNum,
      other_period: otherText,
      start_date: enrollment.start_date || "",
      end_date: enrollment.end_date || "",
      notes: enrollment.notes || "",
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const { error } = await supabase
      .from("sports_academy")
      .delete()
      .eq("id", deletingId);

    if (error) {
      toast({ title: "Error deleting enrollment", variant: "destructive" });
      return;
    }

    toast({ title: "Enrollment deleted" });
    setDeletingId(null);
    fetchEnrollments();
  };

  const toggleSchedulePeriod = (period: string) => {
    setFormData(prev => ({
      ...prev,
      schedule_periods: prev.schedule_periods.includes(period)
        ? prev.schedule_periods.filter(p => p !== period)
        : [...prev.schedule_periods, period]
    }));
  };

  const filteredEnrollments = enrollments.filter(enrollment => {
    // Sport filter
    if (selectedSport !== "all" && enrollment.sport_name !== selectedSport) return false;
    
    // Division filter
    if (selectedDivision !== "all" && enrollment.child?.division_id !== selectedDivision) return false;
    
    // Gender filter
    if (selectedGender !== "all" && enrollment.child?.gender?.toLowerCase() !== selectedGender.toLowerCase()) return false;
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const searchableFields = [
        enrollment.child?.name,
        enrollment.sport_name,
        enrollment.instructor
      ].filter(Boolean).join(" ").toLowerCase();
      
      if (!searchableFields.includes(search)) return false;
    }
    
    return true;
  });

  const uniqueSports = [...new Set(enrollments.map(e => e.sport_name))].sort();

  const groupedBySport = filteredEnrollments.reduce((acc, enrollment) => {
    const sport = enrollment.sport_name;
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(enrollment);
    return acc;
  }, {} as Record<string, any[]>);

  const getDaysWithActivities = () => {
    const dates: Date[] = [];
    enrollments.forEach(enrollment => {
      if (enrollment.start_date) {
        const start = parseISO(enrollment.start_date);
        const end = enrollment.end_date ? parseISO(enrollment.end_date) : new Date();
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.push(new Date(d));
        }
      }
    });
    return dates;
  };

  const getActivitiesForDate = (date: Date) => {
    return filteredEnrollments.filter(enrollment => {
      if (!enrollment.start_date) return false;
      const start = parseISO(enrollment.start_date);
      const end = enrollment.end_date ? parseISO(enrollment.end_date) : new Date();
      return date >= start && date <= end;
    });
  };

  const activeFilterCount = (selectedSport !== "all" ? 1 : 0) + 
    (selectedDivision !== "all" ? 1 : 0) + 
    (selectedGender !== "all" ? 1 : 0) + 
    (searchTerm ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedSport("all");
    setSelectedDivision("all");
    setSelectedGender("all");
    setSearchTerm("");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Sports Academy
          </h1>
          <p className="text-muted-foreground">Manage camper sports academy enrollments</p>
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
          <CSVUploader tableName="sports_academy" onUploadComplete={fetchEnrollments} />
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Enrollment
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by camper, sport, instructor..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedDivision} onValueChange={setSelectedDivision}>
              <SelectTrigger className="w-[150px]">
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

            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="boys">Boys</SelectItem>
                <SelectItem value="girls">Girls</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                {uniqueSports.map((sport) => (
                  <SelectItem key={sport} value={sport}>
                    {sport}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : viewMode === 'calendar' ? (
        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          <Card className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{
                hasActivity: getDaysWithActivities()
              }}
              modifiersClassNames={{
                hasActivity: "bg-primary/20 font-bold"
              }}
              className="rounded-md border"
            />
          </Card>
          <div>
            <h2 className="text-xl font-semibold mb-4">
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </h2>
            {selectedDate && getActivitiesForDate(selectedDate).length > 0 ? (
              <div className="space-y-4">
                {getActivitiesForDate(selectedDate).map((enrollment) => (
                  <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {enrollment.child?.name || "Unknown"}
                          </CardTitle>
                          <Badge className={sportColors[enrollment.sport_name] || "bg-muted"}>
                            {enrollment.sport_name}
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(enrollment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(enrollment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {enrollment.instructor && (
                        <p className="text-sm text-muted-foreground">👤 Instructor: {enrollment.instructor}</p>
                      )}
                      {enrollment.schedule_periods && enrollment.schedule_periods.length > 0 && (
                        <p className="text-sm text-muted-foreground">📅 {enrollment.schedule_periods.join(", ")}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No activities scheduled for this date</p>
              </div>
            )}
          </div>
        </div>
      ) : Object.keys(groupedBySport).length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No sports academy enrollments found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedBySport).map(([sport, sportEnrollments]: [string, any[]]) => (
            <div key={sport}>
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {sport}
                <Badge variant="secondary">{sportEnrollments.length} enrolled</Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sportEnrollments.map((enrollment) => (
                  <Card key={enrollment.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {enrollment.child?.name || "Unknown"}
                          </CardTitle>
                          {enrollment.child?.age && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Age: {enrollment.child.age}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(enrollment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(enrollment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {enrollment.instructor && (
                        <p className="text-sm text-muted-foreground">👤 Instructor: {enrollment.instructor}</p>
                      )}
                      {enrollment.schedule_periods && enrollment.schedule_periods.length > 0 && (
                        <p className="text-sm text-muted-foreground">📅 {enrollment.schedule_periods.join(", ")}</p>
                      )}
                      {enrollment.start_date && (
                        <p className="text-sm text-muted-foreground">
                          📆 {new Date(enrollment.start_date).toLocaleDateString()} 
                          {enrollment.end_date && ` - ${new Date(enrollment.end_date).toLocaleDateString()}`}
                        </p>
                      )}
                      {enrollment.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {enrollment.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEnrollment ? 'Edit Enrollment' : 'Add Enrollment'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Camper *</Label>
              <Select value={formData.child_id} onValueChange={(value) => setFormData({ ...formData, child_id: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select camper" />
                </SelectTrigger>
                <SelectContent>
                  {children && children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name} {child.age && `(${child.age})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sport Name *</Label>
              <Select value={formData.sport_name} onValueChange={(value) => setFormData({ ...formData, sport_name: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select sport" />
                </SelectTrigger>
                <SelectContent>
                  {sportsList.map((sport) => (
                    <SelectItem key={sport} value={sport}>
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Instructor</Label>
              <Input
                value={formData.instructor}
                onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                placeholder="Instructor name"
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule Periods</Label>
              <div className="space-y-2 border rounded-md p-3">
                {periodOptions.map((period) => (
                  <div key={period} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`period-${period}`}
                        checked={formData.schedule_periods.includes(period)}
                        onCheckedChange={() => toggleSchedulePeriod(period)}
                      />
                      <label htmlFor={`period-${period}`} className="text-sm cursor-pointer">
                        {period}
                      </label>
                    </div>
                    {period === "Period #" && formData.schedule_periods.includes(period) && (
                      <Input
                        type="number"
                        value={formData.period_number}
                        onChange={(e) => setFormData({ ...formData, period_number: e.target.value })}
                        placeholder="Enter period number"
                        className="ml-6"
                      />
                    )}
                    {period === "Other" && formData.schedule_periods.includes(period) && (
                      <Input
                        value={formData.other_period}
                        onChange={(e) => setFormData({ ...formData, other_period: e.target.value })}
                        placeholder="Specify other period"
                        className="ml-6"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional notes about the enrollment"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setShowDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button type="submit">{editingEnrollment ? 'Update' : 'Add'} Enrollment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Enrollment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sports academy enrollment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}