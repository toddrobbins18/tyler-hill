import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CalendarRange } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffMultiSelect } from "@/components/StaffMultiSelect";
import { toast } from "sonner";
import TripAttachments from "@/components/TripAttachments";

interface EditTripDialogProps {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditTripDialog({ tripId, open, onOpenChange, onSuccess }: EditTripDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    destination: "",
    date: "",
    end_date: "",
    is_multi_day: false,
    departure_time: "",
    return_time: "",
    chaperone: "",
    capacity: "",
    status: "upcoming",
    meal: "",
    event_type: "",
    event_length: "",
    transportation_type: "",
    driver: "",
  });

  useEffect(() => {
    if (open) {
      fetchTrip();
    }
  }, [open, tripId]);

  const fetchTrip = async () => {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (!error && data) {
      setFormData({
        name: data.name || "",
        type: data.type || "",
        destination: data.destination || "",
        date: data.date || "",
        end_date: data.end_date || "",
        is_multi_day: data.is_multi_day || false,
        departure_time: data.departure_time || "",
        return_time: data.return_time || "",
        chaperone: data.chaperone || "",
        capacity: data.capacity?.toString() || "",
        status: data.status || "upcoming",
        meal: data.meal || "",
        event_type: data.event_type || "",
        event_length: data.event_length || "",
        transportation_type: data.transportation_type || "",
        driver: data.driver || "",
      });
    }
  };

  // Calculate trip duration for display
  const getTripDuration = () => {
    if (!formData.is_multi_day || !formData.date || !formData.end_date) return null;
    const start = new Date(formData.date);
    const end = new Date(formData.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const tripDuration = getTripDuration();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate end date if multi-day
    if (formData.is_multi_day && formData.end_date) {
      if (new Date(formData.end_date) <= new Date(formData.date)) {
        toast.error("End date must be after start date");
        return;
      }
    }
    
    setLoading(true);

    const { error } = await supabase
      .from("trips")
      .update({
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        end_date: formData.is_multi_day ? formData.end_date : null,
      })
      .eq("id", tripId);

    if (error) {
      toast.error("Failed to update trip");
      console.error(error);
    } else {
      toast.success("Trip updated successfully");
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Trip Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Field Trip">Field Trip</SelectItem>
                <SelectItem value="Sporting Event">Sporting Event</SelectItem>
                <SelectItem value="Staff Bus">Staff Bus</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="destination">Destination</Label>
            <Input
              id="destination"
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            />
          </div>

          {/* Multi-day toggle */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />
                Multi-Day Trip
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable this for trips spanning multiple days
              </p>
            </div>
            <Switch
              checked={formData.is_multi_day}
              onCheckedChange={(checked) => {
                setFormData({ 
                  ...formData, 
                  is_multi_day: checked,
                  end_date: checked ? formData.end_date : ""
                });
              }}
            />
          </div>

          {/* Date fields */}
          <div className={`grid ${formData.is_multi_day ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <div>
              <Label htmlFor="date">{formData.is_multi_day ? "Start Date" : "Date"}</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            {formData.is_multi_day && (
              <div>
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.date}
                  required={formData.is_multi_day}
                />
              </div>
            )}
          </div>

          {/* Duration badge */}
          {formData.is_multi_day && tripDuration && tripDuration > 1 && (
            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
              <CalendarRange className="h-3 w-3" />
              {tripDuration}-Day Trip
            </Badge>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="departure_time">Departure Time</Label>
              <Input
                id="departure_time"
                type="time"
                value={formData.departure_time}
                onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="return_time">Return Time</Label>
              <Input
                id="return_time"
                type="time"
                value={formData.return_time}
                onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
              />
            </div>
          </div>

          <StaffMultiSelect
            value={formData.chaperone}
            onChange={(value) => setFormData({ ...formData, chaperone: value })}
            label="Staff"
            placeholder="Search staff to assign..."
          />

          <div>
            <Label htmlFor="capacity">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              placeholder="Maximum number of children"
            />
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="meal">Meal</Label>
            <Select value={formData.meal || "none"} onValueChange={(value) => setFormData({ ...formData, meal: value === "none" ? "" : value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select meal option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="event_type">Event Type</Label>
            <Input
              id="event_type"
              value={formData.event_type}
              onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
              placeholder="e.g., Educational, Recreational"
            />
          </div>

          <div>
            <Label htmlFor="event_length">Event Length</Label>
            <Input
              id="event_length"
              value={formData.event_length}
              onChange={(e) => setFormData({ ...formData, event_length: e.target.value })}
              placeholder="e.g., 2 hours, Half day, Full day"
            />
          </div>

          <div>
            <Label htmlFor="transportation_type">Transportation Type</Label>
            <Select value={formData.transportation_type || "none"} onValueChange={(value) => setFormData({ ...formData, transportation_type: value === "none" ? "" : value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select transportation type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bus">Bus</SelectItem>
                <SelectItem value="van">Van</SelectItem>
                <SelectItem value="car">Car</SelectItem>
                <SelectItem value="walk">Walking</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="driver">Driver</Label>
            <Input
              id="driver"
              value={formData.driver}
              onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
              placeholder="Driver name"
            />
          </div>

          {/* Attachments section for multi-day trips */}
          <TripAttachments tripId={tripId} isMultiDay={formData.is_multi_day} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}