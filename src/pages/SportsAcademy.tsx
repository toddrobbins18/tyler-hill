import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Plus, Pencil, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";

export default function SportsAcademy() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    child_id: "",
    sport_name: "",
    skill_level: "",
    instructor: "",
    schedule_days: [] as string[],
    start_date: "",
    end_date: "",
    notes: "",
  });
  const { toast } = useToast();

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const skillLevels = ["Beginner", "Intermediate", "Advanced"];

  useEffect(() => {
    fetchEnrollments();
    fetchChildren();

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
        child:children(id, name, age, division_id)
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
      .select("id, name, age")
      .eq("status", "active")
      .order("name");
    
    if (data) {
      setChildren(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      schedule_days: formData.schedule_days.length > 0 ? formData.schedule_days : null,
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
      skill_level: "",
      instructor: "",
      schedule_days: [],
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
    setFormData({
      child_id: enrollment.child_id,
      sport_name: enrollment.sport_name,
      skill_level: enrollment.skill_level || "",
      instructor: enrollment.instructor || "",
      schedule_days: enrollment.schedule_days || [],
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

  const toggleScheduleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      schedule_days: prev.schedule_days.includes(day)
        ? prev.schedule_days.filter(d => d !== day)
        : [...prev.schedule_days, day]
    }));
  };

  const filteredEnrollments = enrollments.filter(
    enrollment => selectedSport === "all" || enrollment.sport_name === selectedSport
  );

  const uniqueSports = [...new Set(enrollments.map(e => e.sport_name))].sort();

  const groupedBySport = filteredEnrollments.reduce((acc, enrollment) => {
    const sport = enrollment.sport_name;
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(enrollment);
    return acc;
  }, {} as Record<string, any[]>);

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
          <CSVUploader tableName="sports_academy" onUploadComplete={fetchEnrollments} />
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Enrollment
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div>
          <Label>Sport Filter</Label>
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            <option value="all">All Sports</option>
            {uniqueSports.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
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
                      {enrollment.skill_level && (
                        <Badge>{enrollment.skill_level}</Badge>
                      )}
                      {enrollment.instructor && (
                        <p className="text-sm text-muted-foreground">👤 Instructor: {enrollment.instructor}</p>
                      )}
                      {enrollment.schedule_days && enrollment.schedule_days.length > 0 && (
                        <p className="text-sm text-muted-foreground">📅 {enrollment.schedule_days.join(", ")}</p>
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
              <Label>Camper</Label>
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
              <Label>Sport Name</Label>
              <Input
                value={formData.sport_name}
                onChange={(e) => setFormData({ ...formData, sport_name: e.target.value })}
                placeholder="e.g., Basketball, Soccer, Swimming"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Skill Level</Label>
              <Select value={formData.skill_level} onValueChange={(value) => setFormData({ ...formData, skill_level: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select skill level" />
                </SelectTrigger>
                <SelectContent>
                  {skillLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
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
              <Label>Schedule Days</Label>
              <div className="grid grid-cols-4 gap-2">
                {daysOfWeek.map((day) => (
                  <Button
                    key={day}
                    type="button"
                    variant={formData.schedule_days.includes(day) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleScheduleDay(day)}
                  >
                    {day.substring(0, 3)}
                  </Button>
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
