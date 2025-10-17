import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, List, Pencil, Trash2, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CSVUploader } from "@/components/CSVUploader";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

export default function Menu() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();
  const { selectedSeason } = useSeason();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    meal_type: "breakfast",
    items: "",
    allergens: "",
  });

  useEffect(() => {
    fetchMenuItems();

    const channel = supabase
      .channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchMenuItems())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedSeason]);

  const fetchMenuItems = async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .or(`season.eq.${selectedSeason},season.is.null`)
      .order("date", { ascending: false })
      .order("meal_type");

    if (error) {
      toast({ title: "Error fetching menu items", variant: "destructive" });
      return;
    }
    setMenuItems(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem) {
      const { error } = await supabase
        .from("menu_items")
        .update(formData)
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Error updating menu item", variant: "destructive" });
        return;
      }
      toast({ title: "Menu item updated successfully" });
    } else {
      const { error } = await supabase.from("menu_items").insert(formData);

      if (error) {
        toast({ title: "Error adding menu item", variant: "destructive" });
        return;
      }
      toast({ title: "Menu item added successfully" });
    }

    setFormData({ date: new Date().toISOString().split('T')[0], meal_type: "breakfast", items: "", allergens: "" });
    setEditingItem(null);
    setDialogOpen(false);
    fetchMenuItems();
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      date: item.date,
      meal_type: item.meal_type,
      items: item.items,
      allergens: item.allergens || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);

    if (error) {
      toast({ title: "Error deleting menu item", variant: "destructive" });
      return;
    }
    toast({ title: "Menu item deleted successfully" });
    fetchMenuItems();
  };

  const calendarEvents = menuItems.map(item => ({
    id: item.id,
    title: `${item.meal_type.charAt(0).toUpperCase() + item.meal_type.slice(1)}: ${item.items.substring(0, 30)}...`,
    start: new Date(item.date + 'T00:00:00'),
    end: new Date(item.date + 'T23:59:59'),
    resource: item,
  }));

  const groupedByDate = menuItems.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Menu Management</h1>
          <p className="text-muted-foreground">Manage daily meal menus</p>
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
          <CSVUploader tableName="menu_items" onUploadComplete={fetchMenuItems} />
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingItem(null);
              setFormData({ date: new Date().toISOString().split('T')[0], meal_type: "breakfast", items: "", allergens: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Menu Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
                <DialogDescription>{editingItem ? "Update the menu item details" : "Add a new item to the menu"}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Meal Type</Label>
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
                  <Label>Menu Items</Label>
                  <Textarea value={formData.items} onChange={(e) => setFormData({ ...formData, items: e.target.value })} placeholder="e.g., Pancakes, Fresh Fruit, Milk" required />
                </div>
                <div className="space-y-2">
                  <Label>Allergens (optional)</Label>
                  <Input value={formData.allergens} onChange={(e) => setFormData({ ...formData, allergens: e.target.value })} placeholder="e.g., Contains dairy, nuts" />
                </div>
                <Button type="submit" className="w-full">{editingItem ? "Update Menu Item" : "Add Menu Item"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : menuItems.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No menu items found. Add your first menu item!</CardContent>
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
              onSelectEvent={(event) => handleEdit(event.resource)}
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
          {sortedDates.map((date) => {
            const items = groupedByDate[date];
            return (
              <Card key={date}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="h-5 w-5" />
                    {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items
                    .sort((a, b) => {
                      const mealOrder = { breakfast: 1, lunch: 2, snack: 3, dinner: 4 };
                      return (mealOrder[a.meal_type as keyof typeof mealOrder] || 5) - (mealOrder[b.meal_type as keyof typeof mealOrder] || 5);
                    })
                    .map((item) => (
                      <div key={item.id} className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group relative">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium capitalize mb-1">{item.meal_type}</p>
                            <p className="text-sm">{item.items}</p>
                            {item.allergens && (<p className="text-xs text-muted-foreground mt-1">Allergens: {item.allergens}</p>)}
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}