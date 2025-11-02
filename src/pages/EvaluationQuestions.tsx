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
import { Plus, Pencil, Trash2, ClipboardList, Shield, Building2 } from "lucide-react";
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
  });

  useEffect(() => {
    fetchQuestions();

    const channel = supabase
      .channel('evaluation-questions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evaluation_questions' }, fetchQuestions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("evaluation_questions")
      .select("*")
      .eq("is_active", true)
      .order("category, created_at");

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
      : null;

    const payload = {
      question_text: formData.question_text,
      question_type: formData.question_type,
      category: formData.category || null,
      options: optionsArray,
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

    setFormData({ question_text: "", question_type: "multiple_choice", category: "", options: "" });
    fetchQuestions();
  };

  const handleEdit = (question: any) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type,
      category: question.category || "",
      options: question.options ? question.options.join(", ") : "",
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

  const groupedQuestions = questions.reduce((acc, question) => {
    const category = question.category || "Uncategorized";
    if (!acc[category]) acc[category] = [];
    acc[category].push(question);
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
                      setFormData({ question_text: "", question_type: "multiple_choice", category: "", options: "" });
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
                {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase">{category}</h3>
                    <div className="space-y-2">
                      {(categoryQuestions as any[]).map((question) => (
                        <div
                          key={question.id}
                          className="group p-4 rounded-lg border bg-card hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-medium">{question.question_text}</p>
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="outline">{question.question_type.replace('_', ' ')}</Badge>
                                {question.options && (
                                  <Badge variant="secondary" className="text-xs">
                                    {question.options.length} options
                                  </Badge>
                                )}
                              </div>
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
                ))}
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
