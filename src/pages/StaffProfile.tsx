import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Calendar, TrendingUp, Award, Pencil, ClipboardCheck, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EditStaffDialog from "@/components/dialogs/EditStaffDialog";
import { EvaluateStaffDialog } from "@/components/dialogs/EvaluateStaffDialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [staff, setStaff] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [staffNotes, setStaffNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchStaffData();
    }
  }, [id, navigate]);

  const fetchStaffData = async () => {
    setLoading(true);
    
    // Fetch staff member
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("id", id)
      .single();

    if (staffError) {
      toast.error("Failed to load staff member");
      navigate("/staff");
      return;
    }

    // Fetch evaluations
    const { data: evalsData, error: evalsError } = await supabase
      .from("staff_evaluations")
      .select("*")
      .eq("staff_id", id)
      .eq("company_id", currentCompany?.id || '')
      .order("date", { ascending: false });

    // Fetch staff notes
    const { data: notesData, error: notesError } = await supabase
      .from("staff_notes")
      .select("*")
      .eq("staff_id", id)
      .eq("company_id", currentCompany?.id || '')
      .order("created_at", { ascending: false });

    if (!notesError && notesData) {
      setStaffNotes(notesData);
    }

    if (!evalsError && evalsData) {
      const averageRating = evalsData.length
        ? evalsData.reduce((sum, e) => sum + (Number(e.rating) || 0), 0) / evalsData.length
        : 0;

      setStaff({
        ...staffData,
        averageRating: averageRating.toFixed(1),
      });
      setEvaluations(evalsData);
    } else {
      setStaff(staffData);
    }

    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("staff_notes")
      .insert({
        staff_id: id,
        note: newNote.trim(),
        created_by: user.id,
        company_id: currentCompany?.id || '',
        season: currentSeason
      });

    if (error) {
      toast.error("Failed to add note");
      return;
    }

    toast.success("Note added successfully");
    setNewNote("");
    fetchStaffData();
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Staff member not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/staff")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
            {getInitials(staff.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground mb-1">{staff.name}</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">{staff.role} • {staff.department}</p>
            {staff.staff_type && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {staff.staff_type === "general_counselor" ? "General Counselor" : 
                 staff.staff_type === "specialist" ? "Specialist" : "Both"}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setEvaluateDialogOpen(true)}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Evaluate Staff
          </Button>
          <Button onClick={() => setEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Star className="h-5 w-5 text-warning fill-warning" />
              <span className="text-2xl font-bold">{staff.averageRating}</span>
            </div>
            <p className="text-xs text-muted-foreground">Average Rating</p>
          </div>
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            Active
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="birthday">Birthday</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Professional details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{staff.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{staff.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{staff.department || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hire Date</p>
                  <p className="font-medium">{staff.hire_date ? new Date(staff.hire_date).toLocaleDateString() : "N/A"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Recent evaluation metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Total Evaluations</span>
                  <span className="text-xl font-bold">{evaluations.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <span className="text-xl font-bold">{staff.averageRating || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge 
                    variant="outline"
                    className={
                      staff.status === "active"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {staff.status || "Active"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="birthday" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Birthday Information</CardTitle>
              <CardDescription>Date of birth details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {staff.date_of_birth ? (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="text-2xl font-bold text-primary">
                        {new Date(staff.date_of_birth).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No birthday information available</p>
                  <p className="text-sm mt-1">Click "Edit Profile" to add date of birth</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Add New Note</CardTitle>
              <CardDescription>Document observations and important information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter note details..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[100px]"
              />
              <Button onClick={handleAddNote} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {staffNotes.length} total notes
              </p>
            </div>

            {staffNotes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No notes yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {staffNotes.map((note) => (
                  <Card key={note.id} className="shadow-card">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          <FileText className="h-3 w-3 mr-1" />
                          Staff Note
                        </Badge>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {evaluations.length} total evaluations
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={evaluations.some(e => e.evaluation_round === 1) ? "bg-success/10 text-success border-success/20" : ""}>
                Round 1 {evaluations.some(e => e.evaluation_round === 1) && "✓"}
              </Badge>
              <Badge variant="outline" className={evaluations.some(e => e.evaluation_round === 2) ? "bg-success/10 text-success border-success/20" : ""}>
                Round 2 {evaluations.some(e => e.evaluation_round === 2) && "✓"}
              </Badge>
              <Badge variant="outline" className={evaluations.some(e => e.evaluation_round === 3) ? "bg-success/10 text-success border-success/20" : ""}>
                Round 3 {evaluations.some(e => e.evaluation_round === 3) && "✓"}
              </Badge>
            </div>
          </div>

          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No evaluations yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {evaluations.map((evaluation) => (
                <Card key={evaluation.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                            Round {evaluation.evaluation_round || 1}
                          </Badge>
                          {evaluation.category && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              {evaluation.category}
                            </Badge>
                          )}
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-warning fill-warning" />
                            <span className="font-bold">{evaluation.rating}</span>
                          </div>
                        </div>
                        {evaluation.evaluator && (
                          <p className="text-sm text-muted-foreground">Evaluated by {evaluation.evaluator}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(evaluation.date).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {evaluation.comments && (
                      <p className="text-sm mb-4">{evaluation.comments}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Achievements feature coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditStaffDialog
        staffId={id || ""}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchStaffData}
      />

      <EvaluateStaffDialog
        open={evaluateDialogOpen}
        onOpenChange={setEvaluateDialogOpen}
        staffId={id || ""}
        staffName={staff?.name || ""}
        staffRole={staff?.role || ""}
        staffType={staff?.staff_type || null}
        onSuccess={fetchStaffData}
      />
    </div>
  );
}
