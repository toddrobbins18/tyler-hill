import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, List, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSeason } from "@/contexts/SeasonContext";
import SeasonSelector from "@/components/SeasonSelector";

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface SpecialMeal {
  id: string;
  date: string;
  meal_type: string;
  items: string;
  allergens: string | null;
}

export default function SpecialMeals() {
  const [meals, setMeals] = useState<SpecialMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<SpecialMeal | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const { selectedSeason } = useSeason();
  const [formData, setFormData] = useState({
    date: "",
    meal_type: "breakfast",
    items: "",
    allergens: "",
  });

  const fetchMeals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("special_meals")
      .select("*")
      .or(`season.eq.${selectedSeason},season.is.null`)
      .order("date", { ascending: true });

    if (!error && data) {
      setMeals(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMeals();

    const channel = supabase
      .channel("special-meals-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "special_meals" }, () => { fetchMeals(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedSeason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingMeal) {
      const { error } = await supabase
        .from("special_meals")
        .update(formData)
        .eq("id", editingMeal.id);

      if (error) {
        toast.error("Failed to update special meal");
        console.error(error);
      } else {
        toast.success("Special meal updated successfully");
        setDialogOpen(false);
        setEditingMeal(null);
        resetForm();
      }
    } else {
      const { error } = await supabase.from("special_meals").insert([formData]);

      if (error) {
        toast.error("Failed to add special meal");
        console.error(error);
      } else {
        toast.success("Special meal added successfully");
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("special_meals").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete special meal");
      console.error(error);
    } else {
      toast.success("Special meal deleted successfully");
    }
  };

  const resetForm = () => {
    setFormData({
      date: "",
      meal_type: "breakfast",
      items: "",
      allergens: "",
    });
  };

  const openEditDialog = (meal: SpecialMeal) => {
    setEditingMeal(meal);
    setFormData({
      date: meal.date,
      meal_type: meal.meal_type,
      items: meal.items,
      allergens: meal.allergens || "",
    });
    setDialogOpen(true);
  };

  const calendarEvents = meals.map(meal => ({
    id: meal.id,
    title: `${meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}: ${meal.items.substring(0, 30)}...`,
    start: new Date(meal.date + 'T00:00:00'),
    end: new Date(meal.date + 'T23:59:59'),
    resource: meal,
  }));

  const groupedByDate = meals.reduce((acc, meal) => {
    if (!acc[meal.date]) {
      acc[meal.date] = [];
    }
    acc[meal.date].push(meal);
    return acc;
  }, {} as Record<string, SpecialMeal[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Special Meals Schedule</h1>
          <p className="text-muted-foreground">Plan and manage special dietary events</p>
        </div>
        <div className="flex gap-2">
          <SeasonSelector />
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)}>
            <ToggleGroupItem value="calendar" aria-label="Calendar view">
              <CalendarIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingMeal(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Special Meal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingMeal ? "Edit Special Meal" : "Add Special Meal"}</DialogTitle>
                <DialogDescription>{editingMeal ? "Update the special meal details" : "Schedule a special meal for a specific date"}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meal_type">Meal Type</Label>
                    <Select value={formData.meal_type} onValueChange={(value) => setFormData({ ...formData, meal_type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="snack">Snack</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="items">Menu Items</Label>
                    <Textarea id="items" required placeholder="List the special menu items..." value={formData.items} onChange={(e) => setFormData({ ...formData, items: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allergens">Allergens (optional)</Label>
                    <Input id="allergens" placeholder="e.g., Nuts, Dairy, Gluten" value={formData.allergens} onChange={(e) => setFormData({ ...formData, allergens: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingMeal ? "Update" : "Add"} Special Meal</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : meals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No special meals scheduled yet</p>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              view={calendarView}
              onView={setCalendarView}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={(event) => openEditDialog(event.resource)}
              onSelectSlot={(slotInfo) => {
                setFormData({ ...formData, date: format(slotInfo.start, 'yyyy-MM-dd') });
                setDialogOpen(true);
              }}
              selectable
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dayMeals]) => (
            <Card key={date} className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  <CardTitle>{new Date(date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dayMeals.map((meal) => (
                    <div key={meal.id} className="flex items-start justify-between p-4 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="capitalize">{meal.meal_type}</Badge>
                          {meal.allergens && (<Badge variant="destructive" className="text-xs">Contains: {meal.allergens}</Badge>)}
                        </div>
                        <p className="text-sm">{meal.items}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(meal)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(meal.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}