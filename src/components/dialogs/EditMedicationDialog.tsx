import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  MEDICATION_BEDTIME_OPTIONS,
  STANDARD_MEAL_SCHEDULE_HHMM,
  STANDARD_MEAL_LABEL_ORDER,
  findBedtimeOptionById,
  findBedtimeOptionFromStoredMealLabel,
} from "@/lib/medicationBedtimeOptions";

interface EditMedicationDialogProps {
  medication: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STANDARD_MEAL_LABELS = [...STANDARD_MEAL_LABEL_ORDER];

export function EditMedicationDialog({
  medication,
  open,
  onOpenChange,
  onSuccess
}: EditMedicationDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    medication_name: "",
    dosage: "",
    meal_time: [] as string[],
    notes: "",
    is_recurring: false,
    frequency: "daily",
    days_of_week: [] as string[],
    start_date: null as Date | null,
    end_date: null as Date | null,
    bedtime_option_id: null as string | null,
  });

  useEffect(() => {
    if (medication) {
      const rawMt = medication.meal_time;
      const first = Array.isArray(rawMt) ? rawMt[0] : rawMt;
      let bedtime_option_id: string | null = null;
      let meal_time: string[] = [];

      if (typeof first === "string") {
        const legacyBed = findBedtimeOptionFromStoredMealLabel(first);
        if (legacyBed) {
          bedtime_option_id = legacyBed.id;
          meal_time = ["Bedtime"];
        } else if (first === "Bedtime") {
          const st = medication.scheduled_time as string | undefined;
          const fallback =
            MEDICATION_BEDTIME_OPTIONS.find((o) => o.scheduledTimeHHmm === st)?.id ??
            "bedtime-21-00-freshman";
          bedtime_option_id = fallback;
          meal_time = ["Bedtime"];
        } else if (STANDARD_MEAL_LABELS.includes(first)) {
          meal_time = [first];
        }
      } else if (medication.scheduled_time) {
        const st = medication.scheduled_time as string;
        const standardMatch = STANDARD_MEAL_LABELS.find((label) => STANDARD_MEAL_SCHEDULE_HHMM[label] === st);
        if (standardMatch) {
          meal_time = [standardMatch];
        } else {
          const btMatch = MEDICATION_BEDTIME_OPTIONS.find((o) => o.scheduledTimeHHmm === st);
          if (btMatch) {
            bedtime_option_id = btMatch.id;
            meal_time = ["Bedtime"];
          }
        }
      }

      setFormData({
        medication_name: medication.medication_name || "",
        dosage: medication.dosage || "",
        meal_time,
        notes: medication.notes || "",
        is_recurring: medication.is_recurring || false,
        frequency: medication.frequency || "daily",
        days_of_week: medication.days_of_week || [],
        start_date: medication.date ? new Date(medication.date + "T00:00:00") : null,
        end_date: medication.end_date ? new Date(medication.end_date + "T00:00:00") : null,
        bedtime_option_id,
      });
    }
  }, [medication]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasBedtime = formData.meal_time.includes("Bedtime");
    const standardSelected = formData.meal_time.filter((t) => STANDARD_MEAL_LABELS.includes(t));
    const bedtimeOpt = findBedtimeOptionById(formData.bedtime_option_id);

    if (hasBedtime && standardSelected.length > 0) {
      toast({
        title: "Choose either Bedtime or one meal time for this row",
        variant: "destructive",
      });
      return;
    }

    if (!hasBedtime && standardSelected.length !== 1) {
      toast({ title: "Select exactly one meal time", variant: "destructive" });
      return;
    }

    if (hasBedtime && !bedtimeOpt) {
      toast({ title: "Select a division for Bedtime", variant: "destructive" });
      return;
    }

    let meal_time: string[];
    let scheduled_time: string;

    if (hasBedtime && bedtimeOpt) {
      meal_time = [bedtimeOpt.mealTimeLabel];
      scheduled_time = bedtimeOpt.scheduledTimeHHmm;
    } else {
      const m = standardSelected[0];
      meal_time = [m];
      scheduled_time = STANDARD_MEAL_SCHEDULE_HHMM[m] ?? "12:00";
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from("medication_logs")
      .update({
        medication_name: formData.medication_name,
        dosage: formData.dosage,
        meal_time,
        scheduled_time,
        notes: formData.notes,
        is_recurring: formData.is_recurring,
        frequency: formData.frequency,
        days_of_week: formData.days_of_week,
        date: formData.start_date ? format(formData.start_date, 'yyyy-MM-dd') : medication.date,
        end_date: formData.end_date ? format(formData.end_date, 'yyyy-MM-dd') : null,
      })
      .eq("id", medication.id);

    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error updating medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication updated successfully" });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Medication</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Child</Label>
            <Input value={medication?.children?.name || "Unknown"} disabled />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date ? format(formData.start_date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, start_date: date || null })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date ? format(formData.end_date, "PPP") : <span>No end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date || undefined}
                    onSelect={(date) => setFormData({ ...formData, end_date: date || null })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meal Time</Label>
            <div className="grid grid-cols-2 gap-2">
              {STANDARD_MEAL_LABEL_ORDER.map((mealTime) => (
                <div key={mealTime} className="flex items-center space-x-2">
                  <Checkbox
                    id={`edit-${mealTime}`}
                    checked={formData.meal_time.length === 1 && formData.meal_time[0] === mealTime}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({
                          ...formData,
                          meal_time: [mealTime],
                          bedtime_option_id: null,
                        });
                      } else if (formData.meal_time[0] === mealTime) {
                        setFormData({ ...formData, meal_time: [], bedtime_option_id: null });
                      }
                    }}
                  />
                  <Label
                    htmlFor={`edit-${mealTime}`}
                    className="font-normal cursor-pointer text-sm"
                  >
                    {mealTime}
                  </Label>
                </div>
              ))}
              <div key="Bedtime" className="flex items-center space-x-2">
                <Checkbox
                  id="edit-Bedtime"
                  checked={formData.meal_time.includes("Bedtime")}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({
                        ...formData,
                        meal_time: ["Bedtime"],
                        bedtime_option_id: formData.bedtime_option_id,
                      });
                    } else {
                      setFormData({ ...formData, meal_time: [], bedtime_option_id: null });
                    }
                  }}
                />
                <Label htmlFor="edit-Bedtime" className="font-normal cursor-pointer text-sm">
                  Bedtime
                </Label>
              </div>
            </div>
            {formData.meal_time.includes("Bedtime") && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="edit-bedtime-division-select">Division</Label>
                <Select
                  value={formData.bedtime_option_id ?? "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      bedtime_option_id: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger id="edit-bedtime-division-select">
                    <SelectValue placeholder="Select division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select division</SelectItem>
                    {MEDICATION_BEDTIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.division}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              id="edit-is_recurring"
              checked={formData.is_recurring}
              onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
            />
            <Label htmlFor="edit-is_recurring" className="font-normal cursor-pointer">
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
            </>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
