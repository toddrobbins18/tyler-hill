import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { ChevronDown, ChevronUp } from "lucide-react";

interface EvaluateStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  staffName: string;
  staffRole: string;
  staffType: string | null;
  onSuccess?: () => void;
}

interface EvaluationQuestion {
  id: string;
  question_text: string;
  guidance_text: string | null;
  category: string;
  display_order: number;
  evaluated_by: string;
}

interface QuestionResponse {
  questionId: string;
  rating: number | null;
  textResponse: string;
}

export function EvaluateStaffDialog({
  open,
  onOpenChange,
  staffId,
  staffName,
  staffRole,
  staffType,
  onSuccess,
}: EvaluateStaffDialogProps) {
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, QuestionResponse>>({});
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [evaluator, setEvaluator] = useState("");
  const [overallComments, setOverallComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedGuidance, setExpandedGuidance] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();

  useEffect(() => {
    if (open && staffType) {
      fetchQuestions();
    }
  }, [open, staffType, currentCompany.id]);

  const fetchQuestions = async () => {
    const staffTypes: string[] = [];
    if (staffType === "both") {
      staffTypes.push("general_counselor", "specialist");
    } else if (staffType) {
      staffTypes.push(staffType);
    }

    const { data, error } = await supabase
      .from("evaluation_questions")
      .select("*")
      .eq("company_id", currentCompany.id)
      .in("staff_type", staffTypes)
      .eq("is_active", true)
      .order("staff_type")
      .order("category")
      .order("display_order");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load evaluation questions",
        variant: "destructive",
      });
      return;
    }

    setQuestions(data || []);
    
    // Initialize responses
    const initialResponses: Record<string, QuestionResponse> = {};
    data?.forEach((q) => {
      initialResponses[q.id] = {
        questionId: q.id,
        rating: null,
        textResponse: "",
      };
    });
    setResponses(initialResponses);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all questions have ratings
    const unansweredQuestions = questions.filter(q => !responses[q.id]?.rating);
    if (unansweredQuestions.length > 0) {
      toast({
        title: "Incomplete Evaluation",
        description: `Please rate all ${questions.length} questions before submitting.`,
        variant: "destructive",
      });
      return;
    }

    if (!evaluator.trim()) {
      toast({
        title: "Missing Evaluator",
        description: "Please enter the evaluator's name.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Calculate average rating
    const ratings = Object.values(responses).map(r => r.rating).filter(r => r !== null) as number[];
    const averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

    // Create evaluation record
    const { data: evaluation, error: evalError } = await supabase
      .from("staff_evaluations")
      .insert({
        staff_id: staffId,
        date,
        evaluator,
        comments: overallComments,
        rating: averageRating,
        company_id: currentCompany.id,
        season: selectedSeason,
      })
      .select()
      .single();

    if (evalError || !evaluation) {
      toast({
        title: "Error",
        description: "Failed to create evaluation",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Create response records
    const responseRecords = Object.values(responses).map(r => ({
      evaluation_id: evaluation.id,
      question_id: r.questionId,
      response_value: r.rating,
      response_text: r.textResponse || null,
    }));

    const { error: responseError } = await supabase
      .from("evaluation_responses")
      .insert(responseRecords);

    if (responseError) {
      toast({
        title: "Error",
        description: "Failed to save evaluation responses",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Success",
      description: `Evaluation completed with average rating of ${averageRating.toFixed(1)}/5`,
    });

    setLoading(false);
    onOpenChange(false);
    onSuccess?.();
    
    // Reset form
    setEvaluator("");
    setOverallComments("");
    setDate(new Date().toISOString().split("T")[0]);
  };

  const updateResponse = (questionId: string, field: "rating" | "textResponse", value: number | string) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
  };

  const toggleGuidance = (questionId: string) => {
    setExpandedGuidance(prev => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const getStaffTypeBadge = () => {
    if (!staffType) return null;
    const typeMap: Record<string, string> = {
      general_counselor: "General Counselor",
      specialist: "Specialist",
      both: "Both",
    };
    return typeMap[staffType] || staffType;
  };

  const groupedQuestions = questions.reduce((acc, question) => {
    const key = `${question.category}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(question);
    return acc;
  }, {} as Record<string, EvaluationQuestion[]>);

  const answeredCount = Object.values(responses).filter(r => r.rating !== null).length;
  const totalCount = questions.length;

  if (!staffType || staffType === "not_specified") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Evaluate</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This staff member needs a staff type assigned before they can be evaluated.
            Please edit their profile and set their staff type.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evaluate Staff Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{staffName}</span>
            <Badge variant="secondary">{staffRole}</Badge>
            <Badge>{getStaffTypeBadge()}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Evaluation Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evaluator">Evaluator Name</Label>
              <Input
                id="evaluator"
                value={evaluator}
                onChange={(e) => setEvaluator(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-medium">
              Progress: {answeredCount} / {totalCount} questions answered
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">{category}</h3>
                
                {categoryQuestions.map((question) => (
                  <div key={question.id} className="space-y-3 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <p className="font-medium">{question.question_text}</p>
                      <Badge variant="outline" className="text-xs">
                        {question.evaluated_by}
                      </Badge>
                    </div>

                    {question.guidance_text && (
                      <Collapsible
                        open={expandedGuidance[question.id]}
                        onOpenChange={() => toggleGuidance(question.id)}
                      >
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                          {expandedGuidance[question.id] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          Guidance
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded">
                            {question.guidance_text}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    <div className="space-y-2">
                      <Label>Rating (1-5) *</Label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Button
                            key={rating}
                            type="button"
                            variant={responses[question.id]?.rating === rating ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateResponse(question.id, "rating", rating)}
                            className="w-12"
                          >
                            {rating}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Additional Notes (Optional)</Label>
                      <Textarea
                        value={responses[question.id]?.textResponse || ""}
                        onChange={(e) => updateResponse(question.id, "textResponse", e.target.value)}
                        placeholder="Any specific comments for this question..."
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="overallComments">Overall Comments</Label>
              <Textarea
                id="overallComments"
                value={overallComments}
                onChange={(e) => setOverallComments(e.target.value)}
                placeholder="General evaluation comments..."
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || answeredCount < totalCount}>
                {loading ? "Submitting..." : "Submit Evaluation"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
