import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sun, Moon, Plus, Pencil, Trash2, Calendar as CalendarIcon, Paperclip, FileText, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTime12Hour } from "@/lib/utils";
import { useSeason } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { sortDivisionsGirlsFirst } from "@/lib/divisionUtils";
import { usePermissions } from "@/hooks/usePermissions";
import { toast as sonnerToast } from "sonner";
import { StaffMultiSelect } from "@/components/StaffMultiSelect";
import { notifyStaffAssignment } from "@/lib/notifyStaffAssignment";

export default function SpecialEventsActivities() {
  const { currentCompany } = useCompany();
  const { getDivisionFilter } = usePermissions();
  const [events, setEvents] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showEventDetailDialog, setShowEventDetailDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().split('T')[0],
    title: "",
    description: "",
    event_type: "",
    sub_category: "",
    start_time: "",
    end_time: "",
    location: "",
    division_ids: [] as string[],
    file_url: "",
    file_name: "",
    chaperone: "",
  });

  const subCategoryMap: Record<string, { label: string; color?: string }[]> = {
    "evening-activity": [
      { label: "Divisional Night" },
      { label: "Campus Night" },
      { label: "Full Camp" },
    ],
    "tournament": [
      { label: "Away", color: "bg-orange-500 text-white" },
      { label: "Home", color: "bg-green-800 text-white" },
    ],
    "wednesday-event": [
      { label: "GORDON" },
      { label: "JACOBS" },
      { label: "BOCIAN/MELTER BOWL" },
      { label: "Olympics" },
      { label: "Wacky Wednesday" },
    ],
    "admin-notes": [
      { label: "Picture Day" },
      { label: "Laundry" },
      { label: "Phone Calls" },
      { label: "Outside Event" },
      { label: "Staff Days Off" },
    ],
    "trip": [
      { label: "Teen Trip", color: "bg-black text-white" },
      { label: "Collegiate Trip", color: "bg-blue-600 text-white" },
      { label: "Senior Trip", color: "bg-red-600 text-white" },
      { label: "Junior Trip", color: "bg-purple-600 text-white" },
    ],
  };

  const getSubCategoryColor = (eventType: string, subCategory: string): string | undefined => {
    const subs = subCategoryMap[eventType];
    if (!subs) return undefined;
    return subs.find(s => s.label === subCategory)?.color;
  };
  const { toast } = useToast();
  const { selectedSeason } = useSeason();

  useEffect(() => {
    fetchEvents();
    fetchDivisions();

    const channel = supabase
      .channel('special-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'special_events_activities' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedSeason]);

  const fetchEvents = async () => {
    // Fetch events and division associations in parallel
    const [eventsResult, divisionsResult] = await Promise.all([
      supabase
        .from("special_events_activities")
        .select(`
          *,
          division:divisions(id, name, gender, sort_order)
        `)
        .eq("event_date", selectedDate)
        .eq('company_id', currentCompany.id)
        .order("event_date", { ascending: true })
        .order("time_slot", { ascending: true }),
      supabase
        .from("special_events_divisions")
        .select("event_id, division_id, divisions(id, name, gender, sort_order)")
        .eq('company_id', currentCompany.id)
    ]);

    if (eventsResult.error || divisionsResult.error) {
      toast({ title: "Error fetching schedule", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Filter by season
    const filteredData = (eventsResult.data || []).filter(event => 
      event.season === selectedSeason || event.season === null
    );

    // Build a map of event_id -> divisions for fast lookup
    const divisionMap: Record<string, any[]> = {};
    (divisionsResult.data || []).forEach(link => {
      if (!divisionMap[link.event_id]) {
        divisionMap[link.event_id] = [];
      }
      if (link.divisions) {
        divisionMap[link.event_id].push(link.divisions);
      }
    });

    // Merge divisions into events
    const eventsWithDivisions = filteredData.map(event => ({
      ...event,
      divisions: divisionMap[event.id] || []
    }));

    // Filter events by user's accessible divisions
    let filteredEvents = eventsWithDivisions;
    const divisionFilter = getDivisionFilter();
    if (divisionFilter !== null && divisionFilter.length > 0) {
      filteredEvents = eventsWithDivisions.filter(event => {
        // Check if any of the event's divisions match user's accessible divisions
        const eventDivisions = event.divisions?.map((d: any) => d.id) || [];
        if (event.division?.id) eventDivisions.push(event.division.id);
        return eventDivisions.some((divId: string) => divisionFilter.includes(divId)) || eventDivisions.length === 0;
      });
    }

    setEvents(filteredEvents);
    setLoading(false);
  };

  const fetchDivisions = async () => {
    if (!currentCompany?.id) {
      setDivisions([]);
      return;
    }
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .eq('company_id', currentCompany.id)
      .eq('is_active', true);
    
    if (data) {
      setDivisions(sortDivisionsGirlsFirst(data));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.event_type) {
      toast({ title: "Please select an event type", variant: "destructive" });
      return;
    }

    // Build time_slot - ensure it's never empty (required field in DB)
    const timeSlot = formData.start_time && formData.end_time 
      ? `${formData.start_time} - ${formData.end_time}` 
      : formData.start_time || formData.end_time || "TBD";

    const submitData = {
      event_date: formData.event_date,
      title: formData.title,
      description: formData.description,
      event_type: formData.event_type,
      sub_category: formData.sub_category || null,
      time_slot: timeSlot,
      start_time: formData.start_time || null,
      end_time: formData.end_time || null,
      location: formData.location,
      chaperone: formData.chaperone || null,
      season: selectedSeason,
      company_id: currentCompany?.id,
      file_url: formData.file_url || null,
      file_name: formData.file_name || null,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from("special_events_activities")
        .update(submitData)
        .eq("id", editingEvent.id);

      if (error) {
        toast({ title: "Error updating event", variant: "destructive" });
        return;
      }

      // Update division associations
      await supabase
        .from("special_events_divisions")
        .delete()
        .eq("event_id", editingEvent.id);

      if (formData.division_ids.length > 0) {
        await supabase
          .from("special_events_divisions")
          .insert(
            formData.division_ids.map(divId => ({
              event_id: editingEvent.id,
              division_id: divId,
              company_id: currentCompany?.id,
            }))
          );
      }

      const staffNames = formData.chaperone ? formData.chaperone.split(",").map(s => s.trim()).filter(Boolean) : [];
      if (staffNames.length > 0) {
        notifyStaffAssignment({
          staffNames,
          eventTitle: formData.title,
          eventDate: formData.event_date,
          eventType: "special_event",
          companyId: currentCompany?.id,
        });
      }
      toast({ 
        title: "Event updated successfully",
        description: staffNames.length > 0 ? `Staff assigned & notified: ${staffNames.join(", ")}` : undefined,
      });
    } else {
      const { data: newEvent, error } = await supabase
        .from("special_events_activities")
        .insert(submitData)
        .select()
        .single();

      if (error || !newEvent) {
        toast({ title: "Error adding event", variant: "destructive" });
        return;
      }

      // Insert division associations
      if (formData.division_ids.length > 0) {
        await supabase
          .from("special_events_divisions")
          .insert(
            formData.division_ids.map(divId => ({
              event_id: newEvent.id,
              division_id: divId,
              company_id: currentCompany?.id,
            }))
          );
      }

      const staffNames = formData.chaperone ? formData.chaperone.split(",").map(s => s.trim()).filter(Boolean) : [];
      if (staffNames.length > 0) {
        notifyStaffAssignment({
          staffNames,
          eventTitle: formData.title,
          eventDate: formData.event_date,
          eventType: "special_event",
          companyId: currentCompany?.id,
        });
      }
      toast({ 
        title: "Event added successfully",
        description: staffNames.length > 0 ? `Staff notified: ${staffNames.join(", ")}` : undefined,
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      event_date: new Date().toISOString().split('T')[0],
      title: "",
      description: "",
      event_type: "",
      sub_category: "",
      start_time: "",
      end_time: "",
      location: "",
      division_ids: [],
      file_url: "",
      file_name: "",
      chaperone: "",
    });
    setEditingEvent(null);
    setShowDialog(false);
    fetchEvents();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCompany?.id) return;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentCompany.id}/${Date.now()}.${fileExt}`;
      
      // Upload to a special-events bucket (reusing rainy-day-documents bucket for now)
      const { data, error } = await supabase.storage
        .from('rainy-day-documents')
        .upload(fileName, file);

      if (error) throw error;

      // Get signed URL
      const { data: signedUrlData } = await supabase.storage
        .from('rainy-day-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      setFormData({
        ...formData,
        file_url: signedUrlData?.signedUrl || '',
        file_name: file.name
      });

      sonnerToast.success("File uploaded successfully");
    } catch (error) {
      console.error("File upload error:", error);
      sonnerToast.error("Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    setFormData({
      ...formData,
      file_url: "",
      file_name: ""
    });
  };

  const handleViewEvent = (event: any) => {
    setSelectedEvent(event);
    setShowEventDetailDialog(true);
  };

  const handleEdit = async (event: any) => {
    setEditingEvent(event);
    
    // Fetch division associations
    const { data: divisionLinks } = await supabase
      .from("special_events_divisions")
      .select("division_id")
      .eq("event_id", event.id);
    
    setFormData({
      event_date: event.event_date,
      title: event.title,
      description: event.description || "",
      event_type: event.event_type,
      sub_category: event.sub_category || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      location: event.location || "",
      division_ids: divisionLinks?.map(link => link.division_id) || [],
      file_url: event.file_url || "",
      file_name: event.file_name || "",
      chaperone: event.chaperone || "",
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const { error } = await supabase
      .from("special_events_activities")
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

  const filteredEvents = events.filter(event => {
    if (selectedDivision === "all") return true;
    // Check if any of the event's divisions match the selected division
    return event.divisions?.some((div: any) => div.id === selectedDivision);
  });

  const groupedByDate = filteredEvents.reduce((acc, event) => {
    const date = event.event_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  const formatTimeDisplay = (event: any) => {
    if (event.start_time && event.end_time) {
      return `${formatTime12Hour(event.start_time)} - ${formatTime12Hour(event.end_time)}`;
    }
    if (event.start_time) return formatTime12Hour(event.start_time);
    if (event.end_time) return formatTime12Hour(event.end_time);
    return event.time_slot || '';
  };

  const getTimeSlotIcon = (event: any) => {
    const timeStr = event.start_time || event.time_slot || '';
    if (timeStr.includes('PM') && parseInt(timeStr) >= 5 || timeStr >= '17:00') {
      return <Moon className="h-4 w-4" />;
    }
    return <Sun className="h-4 w-4" />;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            Special Events & Evening Activities
          </h1>
          <p className="text-muted-foreground">Special events and evening activities</p>
        </div>
        <div className="flex gap-2">
          <CSVUploader tableName="special_events_activities" onUploadComplete={fetchEvents} />
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
          />
        </div>
        <div>
          <Label>Division Filter</Label>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            <option value="all">All Divisions</option>
            {divisions && divisions.map((div) => (
              <option key={div.id} value={div.id}>
                {div.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No events scheduled for this period</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, dateEvents]: [string, any[]]) => (
            <div key={date}>
              <h2 className="text-xl font-semibold mb-3">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {dateEvents.map((event) => (
                      <Card key={event.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleViewEvent(event)}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                {getTimeSlotIcon(event)}
                                {event.title}
                                {event.file_url && <Paperclip className="h-4 w-4 text-muted-foreground" />}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {formatTimeDisplay(event)}
                              </p>
                            </div>
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                          <div className="flex gap-2 flex-wrap">
                            <Badge>{event.event_type}</Badge>
                            {event.divisions?.map((div: any) => (
                              <Badge key={div.id} variant="secondary">{div.name}</Badge>
                            ))}
                          </div>
                          {event.location && (
                            <p className="text-sm text-muted-foreground">📍 {event.location}</p>
                          )}
                          {event.chaperone && (
                            <p className="text-sm text-muted-foreground">👤 Staff: {event.chaperone}</p>
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
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
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
              <Label>Event Type</Label>
              <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="special-event">Special Event</SelectItem>
                  <SelectItem value="evening-activity">Evening Activity</SelectItem>
                  <SelectItem value="campfire">Campfire</SelectItem>
                  <SelectItem value="movie-night">Movie Night</SelectItem>
                  <SelectItem value="talent-show">Talent Show</SelectItem>
                  <SelectItem value="game-night">Game Night</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>Divisions (select multiple)</Label>
                {divisions.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, division_ids: divisions.map(d => d.id) })}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, division_ids: [] })}
                    >
                      Deselect All
                    </Button>
                  </div>
                )}
              </div>
              <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                {divisions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No divisions available</p>
                ) : (
                  divisions.map((division) => (
                    <div key={division.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`div-${division.id}`}
                        checked={formData.division_ids.includes(division.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              division_ids: [...formData.division_ids, division.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              division_ids: formData.division_ids.filter(id => id !== division.id)
                            });
                          }
                        }}
                      />
                      <label
                        htmlFor={`div-${division.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {division.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <StaffMultiSelect
              value={formData.chaperone}
              onChange={(value) => setFormData({ ...formData, chaperone: value })}
              label="Staff (optional)"
              placeholder="Search staff to assign..."
            />

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Attachment (optional)</Label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              />
              {formData.file_name ? (
                <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">{formData.file_name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="w-full"
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  {uploadingFile ? "Uploading..." : "Attach File"}
                </Button>
              )}
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
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
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

      {/* Event Detail Dialog */}
      <Dialog open={showEventDetailDialog} onOpenChange={setShowEventDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge>{selectedEvent.event_type}</Badge>
                {selectedEvent.divisions?.map((div: any) => (
                  <Badge key={div.id} variant="secondary">{div.name}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(selectedEvent.event_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{formatTimeDisplay(selectedEvent)}</p>
                </div>
                {selectedEvent.location && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium">📍 {selectedEvent.location}</p>
                  </div>
                )}
              </div>
              {selectedEvent.chaperone && (
                <div>
                  <p className="text-muted-foreground text-sm">Staff</p>
                  <p>👤 {selectedEvent.chaperone}</p>
                </div>
              )}
              {selectedEvent.description && (
                <div>
                  <p className="text-muted-foreground text-sm">Description</p>
                  <p>{selectedEvent.description}</p>
                </div>
              )}
              {selectedEvent.file_url && (
                <div className="border-t pt-4">
                  <p className="text-muted-foreground text-sm mb-2">Attachment</p>
                  <a
                    href={selectedEvent.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 border rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{selectedEvent.file_name || 'Download Attachment'}</span>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
