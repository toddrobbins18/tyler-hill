import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pill, AlertCircle, CheckCircle2, Trash2, Calendar as CalendarIcon, LayoutList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CSVUploader } from "@/components/CSVUploader";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, startOfDay, isToday } from "date-fns";
import { useSeasonContext } from "@/contexts/SeasonContext";

export default function Nurse() {
  const { currentSeason } = useSeasonContext();
  const [children, setChildren] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  useEffect(() => {
    fetchChildren();
    fetchMedications(selectedDate);

    // Realtime subscription for medication logs
    const channel = supabase
      .channel('medication-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medication_logs' },
        () => fetchMedications(selectedDate)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, currentSeason]);

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

  const fetchMedications = async (date?: Date) => {
    const dateStr = date ? format(date, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from("medication_logs")
      .select("*, children(name), staff(name)")
      .eq("date", dateStr)
      .eq("season", currentSeason)
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
      medication_name: formData.medication_name,
      dosage: formData.dosage,
      meal_time: formData.meal_time,
      notes: formData.notes,
      is_recurring: formData.is_recurring,
      frequency: formData.frequency,
      days_of_week: formData.days_of_week,
      end_date: formData.end_date || null,
    });

    if (error) {
      console.error("Medication insert error:", error);
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
    fetchMedications(selectedDate);
  };

  const handleSaveLateNotes = async (medId: string, notes: string) => {
    const { error } = await supabase
      .from("medication_logs")
      .update({
        late_notes: notes,
        late_notes_timestamp: new Date().toISOString(),
      })
      .eq("id", medId);

    if (error) {
      toast({ title: "Error saving notes", variant: "destructive" });
      return;
    }

    toast({ title: "Notes saved successfully" });
    fetchMedications(selectedDate);
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
    fetchMedications(selectedDate);
  };

  const handleDelete = async (medId: string) => {
    const { error } = await supabase
      .from("medication_logs")
      .delete()
      .eq("id", medId);

    if (error) {
      toast({ title: "Error deleting medication", variant: "destructive" });
      return;
    }

    toast({ title: "Medication deleted successfully" });
    fetchMedications();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Nurse Dashboard</h1>
          <p className="text-muted-foreground">Manage children's daily medications</p>
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
          <CSVUploader tableName="medication_logs" onUploadComplete={() => fetchMedications(selectedDate)} />
        </div>
      </div>

      {viewMode === 'calendar' && (
        <div className="grid lg:grid-cols-[350px_1fr] gap-6">
          <Card>
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Medications for {format(selectedDate, 'MMMM d, yyyy')}</CardTitle>
              <CardDescription>
                {isBefore(startOfDay(selectedDate), startOfDay(new Date())) 
                  ? 'Past date - View only with notes option' 
                  : isToday(selectedDate)
                  ? 'Today - Mark medications as administered'
                  : 'Future date - Pre-schedule medications'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : medications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for this date</p>
              ) : (
                <div className="space-y-4">
                  {children
                    .filter(child => medications.some(med => med.child_id === child.id))
                    .map((child) => {
                      const childMeds = medications.filter(med => med.child_id === child.id);
                      return (
                        <div key={child.id} className="border rounded-lg p-4 space-y-3">
                          <h3 className="font-semibold">{child.name}</h3>
                          {childMeds.map((med) => {
                            const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
                            return (
                              <div key={med.id} className="p-3 bg-muted/50 rounded space-y-2">
                                <div className="flex items-start gap-3">
                                  {!isPastDate && (
                                    <Checkbox
                                      checked={med.administered}
                                      onCheckedChange={() => !med.administered && handleAdminister(med.id)}
                                      disabled={med.administered}
                                    />
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{med.medication_name}</span>
                                      {med.administered && (
                                        <Badge variant="outline" className="flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Given
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {med.dosage} - {med.meal_time}
                                    </p>
                                    {med.notes && (
                                      <p className="text-sm text-muted-foreground mt-1">{med.notes}</p>
                                    )}
                                  </div>
                                </div>
                                
                                {isPastDate && (
                                  <div className="space-y-2 mt-2">
                                    <Label className="text-xs">Late Notes (optional)</Label>
                                    <Textarea
                                      placeholder="Add notes here..."
                                      defaultValue={med.late_notes || ""}
                                      onBlur={(e) => {
                                        if (e.target.value !== (med.late_notes || "")) {
                                          handleSaveLateNotes(med.id, e.target.value);
                                        }
                                      }}
                                      rows={2}
                                      className="text-sm"
                                    />
                                    {med.late_notes_timestamp && (
                                      <p className="text-xs text-muted-foreground">
                                        Last updated: {format(new Date(med.late_notes_timestamp), 'MMM d, yyyy h:mm a')}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'list' && (
        <>
          <Tabs defaultValue="log" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="log">Daily Log</TabsTrigger>
          <TabsTrigger value="today">Today's Medications</TabsTrigger>
          <TabsTrigger value="add">Add Medication</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle>Daily Medication Log</CardTitle>
              <CardDescription>Mark off medications administered today</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : medications.length === 0 ? (
                <p className="text-muted-foreground">No medications scheduled for today</p>
              ) : (
                <div className="space-y-4">
                  {children
                    .filter(child => medications.some(med => med.child_id === child.id))
                    .map((child) => {
                      const childMeds = medications.filter(med => med.child_id === child.id);
                      return (
                        <div key={child.id} className="border rounded-lg p-4">
                          <h3 className="font-semibold mb-3">{child.name}</h3>
                          <div className="space-y-2">
                            {childMeds.map((med) => (
                              <div key={med.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded">
                                <Checkbox
                                  checked={med.administered}
                                  onCheckedChange={() => !med.administered && handleAdminister(med.id)}
                                  disabled={med.administered}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{med.medication_name}</span>
                                    {med.administered && (
                                      <Badge variant="outline" className="flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Given
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {med.dosage} - {med.meal_time}
                                  </p>
                                  {med.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">{med.notes}</p>
                                  )}
                                  {med.administered && med.staff?.name && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      By {med.staff.name}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(med.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
        </TabsContent>

        <TabsContent value="today">
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
                            {med.meal_time}
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
        </TabsContent>

        <TabsContent value="add">
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

                <div className="space-y-2">
                  <Label>Meal Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      "Before Breakfast",
                      "After Breakfast", 
                      "Before Lunch",
                      "After Lunch",
                      "Before Dinner",
                      "After Dinner",
                      "Bedtime"
                    ].map((mealTime) => (
                      <div key={mealTime} className="flex items-center space-x-2">
                        <Checkbox
                          id={mealTime}
                          checked={formData.meal_time === mealTime}
                          onCheckedChange={() => setFormData({ ...formData, meal_time: mealTime })}
                        />
                        <Label 
                          htmlFor={mealTime} 
                          className="font-normal cursor-pointer text-sm"
                        >
                          {mealTime}
                        </Label>
                      </div>
                    ))}
                  </div>
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
        </TabsContent>
      </Tabs>
        </>
      )}
    </div>
  );
}
