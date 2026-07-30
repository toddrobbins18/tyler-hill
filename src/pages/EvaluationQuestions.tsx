import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { isTylerHillCamp } from "@/lib/camps";
import { Plus, Pencil, Trash2, ClipboardList, Shield, Building2, Upload, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function EvaluationQuestions() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const { currentCompany } = useCompany();

  const [formData, setFormData] = useState({
    question_text: "",
    question_type: "multiple_choice",
    category: "",
    options: "",
    staff_type: "both",
    evaluated_by: "",
    guidance_text: "",
    display_order: 0,
  });
  const [expandedGuidance, setExpandedGuidance] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!currentCompany?.id) return;
    fetchQuestions();

    const channel = supabase
      .channel('evaluation-questions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluation_questions' }, fetchQuestions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id]);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("evaluation_questions")
      .select("*")
      .eq("is_active", true)
      .eq("company_id", currentCompany?.id)
      .order("staff_type, category, display_order, created_at");

    if (error) {
      toast({ title: "Error fetching questions", variant: "destructive" });
      return;
    }
    setQuestions(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const optionsArray = formData.question_type === "multiple_choice" && formData.options
      ? formData.options.split(",").map(opt => opt.trim())
      : formData.question_type === "rating"
      ? ["1", "2", "3", "4", "5"]
      : null;

    const payload = {
      question_text: formData.question_text,
      question_type: formData.question_type,
      category: formData.category || null,
      options: optionsArray,
      company_id: currentCompany?.id,
      staff_type: formData.staff_type,
      evaluated_by: formData.evaluated_by || null,
      guidance_text: formData.guidance_text || null,
      display_order: formData.display_order || 0,
    };

    if (editingId) {
      const { error } = await supabase
        .from("evaluation_questions")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        toast({ title: "Error updating question", variant: "destructive" });
        return;
      }
      toast({ title: "Question updated successfully" });
      setEditingId(null);
    } else {
      const { error } = await supabase
        .from("evaluation_questions")
        .insert(payload);

      if (error) {
        toast({ title: "Error adding question", variant: "destructive" });
        return;
      }
      toast({ title: "Question added successfully" });
    }

    setFormData({ question_text: "", question_type: "multiple_choice", category: "", options: "", staff_type: "both", evaluated_by: "", guidance_text: "", display_order: 0 });
    fetchQuestions();
  };

  const handleEdit = (question: any) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type,
      category: question.category || "",
      options: question.options ? question.options.join(", ") : "",
      staff_type: question.staff_type || "both",
      evaluated_by: question.evaluated_by || "",
      guidance_text: question.guidance_text || "",
      display_order: question.display_order || 0,
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from("evaluation_questions")
      .update({ is_active: false })
      .eq("id", deleteId);

    if (error) {
      toast({ title: "Error deleting question", variant: "destructive" });
      return;
    }

    toast({ title: "Question deleted successfully" });
    setDeleteId(null);
    fetchQuestions();
  };

  const handleImportSpecialist = async () => {
    if (!isTylerHillCamp(currentCompany?.slug)) return;
    
    setImporting(true);
    const specialistQuestions = [
      { text: "Complies with camp rules and policies (rules/standards/routines/curfew/language/uniform/etc.)", guidance: "• Ensures cell phone usage is not visible to campers\n• Signs in for curfew, on time\n• Models appropriate language, behavior, and dress code\n• Follows rest hour / quiet time procedures", category: "Professionalism", evaluator: "Division Leader", order: 1 },
      { text: "Cooperates with Division Leader and other staff members", guidance: "• Maintains positive, professional relationships with staff\n• Willingly assists peers when help is needed\n• Participates constructively in staff meetings\n• Respects Division Leader's decisions and direction", category: "Teamwork", evaluator: "Division Leader", order: 2 },
      { text: "Demonstrates positive interactions with children", guidance: "• Shows genuine interest in campers' well-being\n• Builds trusting relationships with campers\n• Treats all campers with respect and fairness\n• Creates an inclusive, welcoming atmosphere", category: "Child Interaction", evaluator: "Division Leader", order: 3 },
      { text: "Demonstrates consistent reliability and attendance", guidance: "• Arrives on time for all duties and activities\n• Consistently follows daily schedule\n• Rarely misses assignments or responsibilities\n• Communicates proactively about schedule conflicts", category: "Professionalism", evaluator: "Division Leader", order: 4 },
      { text: "Shows enthusiasm and maintains a positive attitude", guidance: "• Displays energy and excitement for camp activities\n• Maintains positive demeanor even in challenging situations\n• Inspires campers through modeling optimistic outlook\n• Brings creative ideas and solutions to the specialty area", category: "Attitude", evaluator: "Division Leader", order: 5 },
      { text: "Demonstrates preparedness and knowledge of specialty area", guidance: "• Shows proficiency in specialty skills and techniques\n• Stays current with specialty trends and best practices\n• Plans engaging, age-appropriate activities\n• Adapts programming to different skill levels", category: "Specialty Skills", evaluator: "Head Specialist", order: 6 },
      { text: "Maintains clean, safe, and organized specialty area", guidance: "• Keeps equipment properly stored and maintained\n• Ensures activity area is safe for all participants\n• Follows safety protocols consistently\n• Reports maintenance or safety concerns promptly", category: "Specialty Management", evaluator: "Head Specialist", order: 7 },
      { text: "Displays effective behavior management techniques", guidance: "• Sets and enforces clear expectations\n• Uses positive reinforcement effectively\n• Handles discipline issues appropriately\n• Maintains control while being approachable", category: "Child Management", evaluator: "Head Specialist", order: 8 },
      { text: "Demonstrates creativity and innovation in programming", guidance: "• Develops new, engaging specialty activities\n• Adapts activities to maintain camper interest\n• Creates special events or showcases for specialty\n• Incorporates camper feedback into programming", category: "Program Development", evaluator: "Head Specialist", order: 9 },
      { text: "Communicates effectively with staff and administration", guidance: "• Provides clear updates to supervisors\n• Responds promptly to communications\n• Documents concerns and incidents appropriately\n• Collaborates well with other specialists", category: "Communication", evaluator: "Head Specialist", order: 10 },
      { text: "Shows initiative and problem-solving abilities", guidance: "• Proactively addresses issues before escalation\n• Seeks solutions independently when appropriate\n• Brings concerns and suggestions to supervisors\n• Takes ownership of specialty area success", category: "Leadership", evaluator: "Head Specialist", order: 11 },
      { text: "Overall performance rating", guidance: "• Consider all aspects of performance\n• Reflects growth and improvement over evaluation period\n• Includes contributions beyond basic job requirements\n• Evaluates readiness for additional responsibilities", category: "Overall", evaluator: "Both", order: 12 },
    ];

    for (const q of specialistQuestions) {
      await supabase.from("evaluation_questions").insert({
        question_text: q.text,
        question_type: "rating",
        category: q.category,
        options: ["1", "2", "3", "4", "5"],
        company_id: currentCompany.id,
        staff_type: "specialist",
        evaluated_by: q.evaluator,
        guidance_text: q.guidance,
        display_order: q.order,
      });
    }

    toast({ title: "Specialist evaluation imported", description: "12 questions added successfully" });
    setImporting(false);
    fetchQuestions();
  };

  const handleImportGeneralCounselor = async () => {
    if (!isTylerHillCamp(currentCompany?.slug)) return;
    
    setImporting(true);
    const counselorQuestions = [
      { text: "Complies with camp rules and policies (rules/standards/routines/curfew/language/uniform/etc.)", guidance: "• Ensures cell phone usage is not visible to campers\n• Signs in for curfew, on time\n• Models appropriate language, behavior, and dress code\n• Follows rest hour / quiet time procedures", category: "Professionalism", order: 1 },
      { text: "Cooperates with Division Leader and other staff members", guidance: "• Maintains positive, professional relationships with staff\n• Willingly assists peers when help is needed\n• Participates constructively in staff meetings\n• Respects Division Leader's decisions and direction", category: "Teamwork", order: 2 },
      { text: "Demonstrates positive interactions with children", guidance: "• Shows genuine interest in campers' well-being\n• Builds trusting relationships with campers\n• Treats all campers with respect and fairness\n• Creates an inclusive, welcoming atmosphere", category: "Child Interaction", order: 3 },
      { text: "Demonstrates consistent reliability and attendance", guidance: "• Arrives on time for all duties and activities\n• Consistently follows daily schedule\n• Rarely misses assignments or responsibilities\n• Communicates proactively about schedule conflicts", category: "Professionalism", order: 4 },
      { text: "Shows enthusiasm and maintains a positive attitude", guidance: "• Displays energy and excitement for camp activities\n• Maintains positive demeanor even in challenging situations\n• Inspires campers through modeling optimistic outlook\n• Brings creative ideas and solutions to daily routines", category: "Attitude", order: 5 },
      { text: "Maintains clean and organized bunk environment", guidance: "• Keeps living area neat and sanitary\n• Ensures campers maintain personal hygiene\n• Enforces bunk cleanup and organization standards\n• Creates comfortable, welcoming living space", category: "Bunk Management", order: 6 },
      { text: "Displays effective behavior management techniques", guidance: "• Sets and enforces clear expectations\n• Uses positive reinforcement effectively\n• Handles discipline issues appropriately\n• Maintains control while being approachable", category: "Child Management", order: 7 },
      { text: "Participates actively in all camp activities and programs", guidance: "• Engages fully in scheduled activities\n• Shows enthusiasm during special events\n• Supports other staff during programs\n• Takes initiative in activity participation", category: "Participation", order: 8 },
      { text: "Communicates effectively with parents and administration", guidance: "• Provides thoughtful updates to parents\n• Responds promptly to parent communications\n• Documents concerns appropriately\n• Maintains professional tone in all communications", category: "Communication", order: 9 },
      { text: "Overall performance rating", guidance: "• Consider all aspects of performance\n• Reflects growth and improvement over evaluation period\n• Includes contributions beyond basic job requirements\n• Evaluates readiness for additional responsibilities", category: "Overall", order: 10 },
    ];

    for (const q of counselorQuestions) {
      await supabase.from("evaluation_questions").insert({
        question_text: q.text,
        question_type: "rating",
        category: q.category,
        options: ["1", "2", "3", "4", "5"],
        company_id: currentCompany.id,
        staff_type: "general_counselor",
        evaluated_by: "Division Leader",
        guidance_text: q.guidance,
        display_order: q.order,
      });
    }

    toast({ title: "General counselor evaluation imported", description: "10 questions added successfully" });
    setImporting(false);
    fetchQuestions();
  };

  const groupedQuestions = questions.reduce((acc, question) => {
    const staffType = question.staff_type || "both";
    const category = question.category || "Uncategorized";
    const key = `${staffType}:${category}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(question);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Evaluation Questions</h1>
        <p className="text-muted-foreground">Manage questions for staff evaluations</p>
      </div>

      {/* Super Admin Status Banner */}
      {isSuperAdmin && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="bg-primary">
                  Super Admin
                </Badge>
                {currentCompany && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>Viewing: <strong className="text-foreground">{currentCompany.name}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tyler Hill Camp Import Section */}
      {isTylerHillCamp(currentCompany?.slug) && (
        <Card className="p-6 border-2 border-dashed">
          <div className="flex items-start gap-4">
            <Upload className="h-6 w-6 text-primary mt-1" />
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">Import Tyler Hill Camp Standard Evaluations</h3>
                <p className="text-sm text-muted-foreground">
                  Import pre-configured evaluation forms with rating scales (1-5) and guidance text.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button 
                  onClick={handleImportSpecialist} 
                  disabled={importing}
                  variant="outline"
                  className="flex-1 min-w-[200px]"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Specialist Evaluation (12 questions)
                </Button>
                <Button 
                  onClick={handleImportGeneralCounselor} 
                  disabled={importing}
                  variant="outline"
                  className="flex-1 min-w-[200px]"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import General Counselor (10 questions)
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <CardTitle>{editingId ? "Edit Question" : "Add Question"}</CardTitle>
            </div>
            <CardDescription>Create or update evaluation questions</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Question Text</Label>
                <Textarea
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  required
                  placeholder="Enter the evaluation question..."
                />
              </div>

              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={formData.question_type} onValueChange={(value) => setFormData({ ...formData, question_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="text">Text Response</SelectItem>
                    <SelectItem value="rating">Rating Scale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Communication, Teamwork"
                />
              </div>

              <div className="space-y-2">
                <Label>Staff Type</Label>
                <Select value={formData.staff_type} onValueChange={(value) => setFormData({ ...formData, staff_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="specialist">Specialist</SelectItem>
                    <SelectItem value="general_counselor">General Counselor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Evaluated By</Label>
                <Input
                  value={formData.evaluated_by}
                  onChange={(e) => setFormData({ ...formData, evaluated_by: e.target.value })}
                  placeholder="e.g., Division Leader, Head Specialist"
                />
              </div>

              <div className="space-y-2">
                <Label>Guidance Text (optional)</Label>
                <Textarea
                  value={formData.guidance_text}
                  onChange={(e) => setFormData({ ...formData, guidance_text: e.target.value })}
                  placeholder="Bullet points to help evaluators rate consistently..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              {formData.question_type === "multiple_choice" && (
                <div className="space-y-2">
                  <Label>Options (comma-separated)</Label>
                  <Input
                    value={formData.options}
                    onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                    placeholder="e.g., Excellent, Good, Fair, Poor"
                  />
                </div>
              )}

              {formData.question_type === "rating" && (
                <p className="text-xs text-muted-foreground">Rating questions use a 1-5 scale by default.</p>
              )}

              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingId ? "Update" : "Add"} Question
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ question_text: "", question_type: "multiple_choice", category: "", options: "", staff_type: "both", evaluated_by: "", guidance_text: "", display_order: 0 });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions Library</CardTitle>
            <CardDescription>All evaluation questions organized by category</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading questions...</p>
            ) : Object.keys(groupedQuestions).length === 0 ? (
              <p className="text-muted-foreground">No questions yet. Add your first question!</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedQuestions).map(([key, categoryQuestions]) => {
                  const [staffType, category] = key.split(':');
                  return (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center gap-2">
                        {staffType !== 'both' && (
                          <Badge variant={staffType === 'specialist' ? 'default' : 'secondary'}>
                            {staffType === 'specialist' ? 'Specialist' : 'General Counselor'}
                          </Badge>
                        )}
                        <h3 className="font-semibold text-sm text-muted-foreground uppercase">{category}</h3>
                      </div>
                      <div className="space-y-2">
                        {(categoryQuestions as any[]).map((question) => (
                          <div
                            key={question.id}
                            className="group p-4 rounded-lg border bg-card hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium">{question.question_text}</p>
                                <div className="flex gap-2 flex-wrap items-center">
                                  <Badge variant="outline">{question.question_type.replace('_', ' ')}</Badge>
                                  {question.options && (
                                    <Badge variant="secondary" className="text-xs">
                                      {question.options.length} options
                                    </Badge>
                                  )}
                                  {question.evaluated_by && (
                                    <span className="text-xs text-muted-foreground">
                                      Evaluated by: {question.evaluated_by}
                                    </span>
                                  )}
                                </div>
                                {question.guidance_text && (
                                  <div className="mt-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => setExpandedGuidance(prev => ({
                                        ...prev,
                                        [question.id]: !prev[question.id]
                                      }))}
                                    >
                                      {expandedGuidance[question.id] ? (
                                        <>
                                          <ChevronUp className="h-3 w-3 mr-1" />
                                          Hide guidance
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-3 w-3 mr-1" />
                                          Show guidance
                                        </>
                                      )}
                                    </Button>
                                    {expandedGuidance[question.id] && (
                                      <div className="mt-2 p-3 bg-muted/50 rounded text-xs whitespace-pre-line">
                                        {question.guidance_text}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEdit(question)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteId(question.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
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
