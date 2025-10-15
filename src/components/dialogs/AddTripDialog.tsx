import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddTripDialogProps {
  onSuccess: () => void;
}

export default function AddTripDialog({ onSuccess }: AddTripDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "Field Trip",
    destination: "",
    date: new Date().toISOString().split('T')[0],
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("trips")
      .insert([{
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
      }]);

    if (error) {
      toast.error("Failed to add trip");
      console.error(error);
    } else {
      toast.success("Trip added successfully");
      onSuccess();
      setOpen(false);
      setFormData({
        name: "",
        type: "Field Trip",
        destination: "",
        date: new Date().toISOString().split('T')[0],
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
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Trip
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Trip Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g., Science Museum Visit"
            />
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Field Trip">Field Trip</SelectItem>
                <SelectItem value="Sporting Event">Sporting Event</SelectItem>
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
              placeholder="Where are you going?"
            />
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

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

          <div>
            <Label htmlFor="chaperone">Chaperone</Label>
            <Input
              id="chaperone"
              value={formData.chaperone}
              onChange={(e) => setFormData({ ...formData, chaperone: e.target.value })}
              placeholder="Who will supervise?"
            />
          </div>

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
            <Label htmlFor="meal">Meal</Label>
            <Select value={formData.meal} onValueChange={(value) => setFormData({ ...formData, meal: value })}>
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
            <Select value={formData.transportation_type} onValueChange={(value) => setFormData({ ...formData, transportation_type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select transportation type" />
              </SelectTrigger>
              <SelectContent>
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
