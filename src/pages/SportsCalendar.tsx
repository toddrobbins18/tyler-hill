import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";

export default function SportsCalendar() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().split('T')[0],
    title: "",
    description: "",
    sport_type: "",
    time: "",
    location: "",
    team: "",
    opponent: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('sports-calendar-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sports_calendar' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("sports_calendar")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      toast({ title: "Error fetching events", variant: "destructive" });
      setLoading(false);
      return;
    }
    setEvents(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingEvent) {
      const { error } = await supabase
        .from("sports_calendar")
        .update(formData)
        .eq("id", editingEvent.id);

      if (error) {
        toast({ title: "Error updating event", variant: "destructive" });
        return;
      }
      toast({ title: "Event updated successfully" });
    } else {
      const { error } = await supabase
        .from("sports_calendar")
        .insert(formData);

      if (error) {
        toast({ title: "Error adding event", variant: "destructive" });
        return;
      }
      toast({ title: "Event added successfully" });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      event_date: new Date().toISOString().split('T')[0],
      title: "",
      description: "",
      sport_type: "",
      time: "",
      location: "",
      team: "",
      opponent: "",
    });
    setEditingEvent(null);
    setShowDialog(false);
    fetchEvents();
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      event_date: event.event_date,
      title: event.title,
      description: event.description || "",
      sport_type: event.sport_type,
      time: event.time || "",
      location: event.location || "",
      team: event.team || "",
      opponent: event.opponent || "",
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const { error } = await supabase
      .from("sports_calendar")
      .delete()
      .eq("id", deletingId);

    if (error) {
      toast({ title: "Error deleting event", variant: "destructive" });
      return;
    }

    toast({ title: "Event deleted" });
    setDeletingId(null);
    fetchEvents();
  };

  const groupedEvents: Record<string, any[]> = events.reduce((acc, event) => {
    const date = new Date(event.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Sports Calendar
          </h1>
          <p className="text-muted-foreground">Track sports events and games</p>
        </div>
        <div className="flex gap-2">
          <CSVUploader tableName="sports_calendar" onUploadComplete={fetchEvents} />
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No sports events scheduled</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="text-xl font-semibold mb-3">{month}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {monthEvents.map((event) => (
                  <Card key={event.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(event)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Badge>{event.sport_type}</Badge>
                      {event.time && (
                        <p className="text-sm text-muted-foreground">⏰ {event.time}</p>
                      )}
                      {event.location && (
                        <p className="text-sm text-muted-foreground">📍 {event.location}</p>
                      )}
                      {event.team && event.opponent && (
                        <p className="text-sm font-medium">{event.team} vs {event.opponent}</p>
                      )}
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Sports Event' : 'Add Sports Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Event Date</Label>
              <Input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Sport Type</Label>
              <Select value={formData.sport_type} onValueChange={(value) => setFormData({ ...formData, sport_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sport type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basketball">Basketball</SelectItem>
                  <SelectItem value="soccer">Soccer</SelectItem>
                  <SelectItem value="baseball">Baseball</SelectItem>
                  <SelectItem value="swimming">Swimming</SelectItem>
                  <SelectItem value="track">Track & Field</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time (optional)</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Team (optional)</Label>
              <Input
                value={formData.team}
                onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                placeholder="Your team name"
              />
            </div>

            <div className="space-y-2">
              <Label>Opponent (optional)</Label>
              <Input
                value={formData.opponent}
                onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                placeholder="Opponent team name"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setShowDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button type="submit">{editingEvent ? 'Update' : 'Add'} Event</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sports Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
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
