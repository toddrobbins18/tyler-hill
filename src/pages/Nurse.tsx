import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pill, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CSVUploader } from "@/components/CSVUploader";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function Nurse() {
  const [children, setChildren] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    medication_name: "",
    dosage: "",
    meal_time: "Before Breakfast",
    notes: "",
    is_recurring: false,
    frequency: "daily",
    days_of_week: [] as string[],
    end_date: "",
  });

  const mealTimes = [
    "Before Breakfast",
    "After Breakfast",
    "Before Lunch",
    "After Lunch",
    "Before Dinner",
    "After Dinner",
    "Bedtime"
  ];

  useEffect(() => {
    fetchChildren();
    fetchMedications();

    // Realtime subscription for medication logs
    const channel = supabase
      .channel('medication-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medication_logs' },
        () => fetchMedications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchChildren = async () => {
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("status", "active")
      .order("name");

    if (error) {
      toast({ title: "Error fetching children", variant: "destructive" });
      return;
    }
    setChildren(data || []);
    setLoading(false);
  };

  const fetchMedications = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("medication_logs")
      .select("*, children(name), staff(name)")
      .eq("date", today)
      .order("meal_time");

    if (error) {
      toast({ title: "Error fetching medications", variant: "destructive" });
      return;
    }
    setMedications(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) {
      toast({ title: "Please select a child", variant: "destructive" });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from("medication_logs").insert({
      child_id: selectedChild,
      date: today,
      ...formData,
    });

    if (error) {
      toast({ title: "Error adding medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication added successfully" });
    setFormData({ 
      medication_name: "", 
      dosage: "", 
      meal_time: "Before Breakfast", 
      notes: "",
      is_recurring: false,
      frequency: "daily",
      days_of_week: [],
      end_date: "",
    });
    setSelectedChild("");
    fetchMedications();
  };

  const handleAdminister = async (medId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: staffData } = await supabase
      .from("staff")
      .select("id")
      .eq("email", user?.email)
      .single();

    const { error } = await supabase
      .from("medication_logs")
      .update({
        administered: true,
        administered_by: staffData?.id,
        administered_at: new Date().toISOString(),
      })
      .eq("id", medId);

    if (error) {
      toast({ title: "Error updating medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication marked as administered" });
    fetchMedications();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Nurse Dashboard</h1>
        <p className="text-muted-foreground">Manage children's daily medications</p>
      </div>

      <div className="flex justify-end mb-4">
        <CSVUploader tableName="medication_logs" onUploadComplete={fetchMedications} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              <CardTitle>Add Medication</CardTitle>
            </div>
            <CardDescription>Schedule medication for a child</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Child</Label>
                <Select value={selectedChild} onValueChange={setSelectedChild}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a child" />
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

              <div className="space-y-3">
                <Label>Medication Time</Label>
                <RadioGroup 
                  value={formData.meal_time} 
                  onValueChange={(value) => setFormData({ ...formData, meal_time: value })}
                >
                  {mealTimes.map((time) => (
                    <div key={time} className="flex items-center space-x-2">
                      <RadioGroupItem value={time} id={time} />
                      <Label htmlFor={time} className="font-normal cursor-pointer">
                        {time}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
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
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked as boolean })}
                />
                <Label htmlFor="is_recurring" className="font-normal cursor-pointer">
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

                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date (optional)</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </>
              )}

              <Button type="submit" className="w-full">Add Medication</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Medications</CardTitle>
            <CardDescription>Track medication administration</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : medications.length === 0 ? (
              <p className="text-muted-foreground">No medications scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {medications.map((med) => (
                  <div
                    key={med.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{med.children?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {med.medication_name} - {med.dosage}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {med.meal_time || med.scheduled_time}
                        </p>
                      </div>
                      {med.administered ? (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Given
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 text-warning" />
                          Pending
                        </Badge>
                      )}
                    </div>
                    {!med.administered && (
                      <Button
                        size="sm"
                        onClick={() => handleAdminister(med.id)}
                        className="w-full mt-2"
                      >
                        Mark as Administered
                      </Button>
                    )}
                    {med.administered && med.staff?.name && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Administered by {med.staff.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
