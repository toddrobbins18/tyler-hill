import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Star } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSeason } from "@/contexts/SeasonContext";

interface Question {
  id: string;
  question_text: string;
  question_type: 'rating' | 'text' | 'multiple_choice';
  options?: string[];
  sort_order: number;
}

interface EvaluateCamperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  reportType: '10_day' | 'end_of_summer';
  existingReport?: any;
  onSuccess: () => void;
}

export default function EvaluateCamperDialog({
  open,
  onOpenChange,
  childId,
  reportType,
  existingReport,
  onSuccess,
}: EvaluateCamperDialogProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [fetchingQuestions, setFetchingQuestions] = useState(true);
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();

  useEffect(() => {
    if (open && currentCompany?.id) {
      fetchQuestions();
      
      if (existingReport) {
        setResponses(existingReport.report_data || {});
        setReportDate(new Date(existingReport.report_date));
      } else {
        setResponses({});
        setReportDate(new Date());
      }
    }
  }, [open, currentCompany, reportType, existingReport]);

  const fetchQuestions = async () => {
    if (!currentCompany?.id) return;

    setFetchingQuestions(true);
    try {
      const { data, error } = await supabase
        .from('camper_evaluation_questions')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('report_type', reportType)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const parsedQuestions: Question[] = (data || []).map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type as 'rating' | 'text' | 'multiple_choice',
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        sort_order: q.sort_order,
      }));

      setQuestions(parsedQuestions);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast({ title: "Error loading questions", variant: "destructive" });
    } finally {
      setFetchingQuestions(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentCompany?.id) return;

    // Validate all questions are answered
    const unansweredQuestions = questions.filter(q => !responses[q.id]);
    if (unansweredQuestions.length > 0) {
      toast({ 
        title: "Please answer all questions", 
        description: `${unansweredQuestions.length} question${unansweredQuestions.length > 1 ? 's' : ''} remaining`,
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const reportData = {
        child_id: childId,
        report_type: reportType,
        report_date: format(reportDate, 'yyyy-MM-dd'),
        report_data: responses,
        company_id: currentCompany.id,
        season: selectedSeason,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      };

      if (existingReport) {
        const { error } = await supabase
          .from('camper_reports')
          .update(reportData)
          .eq('id', existingReport.id);

        if (error) throw error;
        toast({ title: "Report updated successfully" });
      } else {
        const { error } = await supabase
          .from('camper_reports')
          .insert([reportData]);

        if (error) throw error;
        toast({ title: "Report created successfully" });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving report:', error);
      toast({ title: "Error saving report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (question: Question) => {
    switch (question.question_type) {
      case 'rating':
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <Button
                  key={rating}
                  type="button"
                  variant={responses[question.id] === rating ? "default" : "outline"}
                  size="sm"
                  onClick={() => setResponses({ ...responses, [question.id]: rating })}
                  className="gap-1"
                >
                  <Star className={cn("h-4 w-4", responses[question.id] === rating && "fill-current")} />
                  {rating}
                </Button>
              ))}
            </div>
          </div>
        );

      case 'text':
        return (
          <Textarea
            value={responses[question.id] || ''}
            onChange={(e) => setResponses({ ...responses, [question.id]: e.target.value })}
            placeholder="Enter your response..."
            rows={4}
            className="resize-none"
          />
        );

      case 'multiple_choice':
        return (
          <RadioGroup
            value={responses[question.id] || ''}
            onValueChange={(value) => setResponses({ ...responses, [question.id]: value })}
          >
            {(question.options || []).map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${index}`} />
                <Label htmlFor={`${question.id}-${index}`} className="font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      default:
        return null;
    }
  };

  const reportTypeName = reportType === '10_day' ? '10-Day Report' : 'End of Summer Report';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingReport ? 'Edit' : 'Create'} {reportTypeName}
          </DialogTitle>
          <DialogDescription>
            Complete the evaluation questions below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Report Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !reportDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {reportDate ? format(reportDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={reportDate}
                  onSelect={(date) => date && setReportDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {fetchingQuestions ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No evaluation questions configured yet.</p>
              <p className="text-sm mt-1">Please contact an administrator to set up questions.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-3 p-4 border rounded-lg">
                  <Label className="text-base font-medium">
                    {index + 1}. {question.question_text}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  {renderQuestion(question)}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || questions.length === 0}>
            {loading ? "Saving..." : existingReport ? "Update Report" : "Create Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
