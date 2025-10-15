import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface ManageTripAttendanceDialogProps {
  tripId: string | null;
  tripName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageTripAttendanceDialog({
  tripId,
  tripName,
  open,
  onOpenChange,
}: ManageTripAttendanceDialogProps) {
  const [children, setChildren] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<Set<string>>(new Set());
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && tripId) {
      fetchDivisionsAndChildren();
      fetchAttendees();
    }
  }, [open, tripId]);

  const fetchDivisionsAndChildren = async () => {
    const { data: divisionsData } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");

    const { data: childrenData } = await supabase
      .from("children")
      .select("*, division:divisions(*)")
      .eq("status", "active")
      .order("name");

    if (divisionsData) setDivisions(divisionsData);
    if (childrenData) setChildren(childrenData);
  };

  const fetchAttendees = async () => {
    if (!tripId) return;

    const { data } = await supabase
      .from("trip_attendees")
      .select("child_id")
      .eq("trip_id", tripId);

    if (data) {
      setAttendees(new Set(data.map((a) => a.child_id)));
    }
  };

  const toggleAttendee = (childId: string) => {
    const newAttendees = new Set(attendees);
    if (newAttendees.has(childId)) {
      newAttendees.delete(childId);
    } else {
      newAttendees.add(childId);
    }
    setAttendees(newAttendees);
  };

  const handleSubmit = async () => {
    if (!tripId) return;
    setLoading(true);

    try {
      // Delete all existing attendees for this trip
      await supabase
        .from("trip_attendees")
        .delete()
        .eq("trip_id", tripId);

      // Insert new attendees
      if (attendees.size > 0) {
        const attendeesData = Array.from(attendees).map((childId) => ({
          trip_id: tripId,
          child_id: childId,
          confirmed: true,
        }));

        const { error } = await supabase
          .from("trip_attendees")
          .insert(attendeesData);

        if (error) throw error;
      }

      toast.success(`Roster updated: ${attendees.size} attendees`);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update roster");
    } finally {
      setLoading(false);
    }
  };

  const filteredChildren = selectedDivision === "all"
    ? children
    : children.filter((child) => child.division_id === selectedDivision);

  const groupedByDivision = children.reduce((acc, child) => {
    const divName = child.division?.name || "No Division";
    if (!acc[divName]) acc[divName] = [];
    acc[divName].push(child);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Roster: {tripName}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="by-division" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="by-division">By Division</TabsTrigger>
            <TabsTrigger value="filter">Filter</TabsTrigger>
          </TabsList>

          <TabsContent value="by-division" className="space-y-4 max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedByDivision).map(([divName, divChildren]: [string, any[]]) => (
              <div key={divName} className="space-y-2">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  {divName}
                  <Badge variant="secondary">
                    {divChildren.filter((c) => attendees.has(c.id)).length} / {divChildren.length}
                  </Badge>
                </Label>
                <div className="grid grid-cols-2 gap-2 pl-4">
                  {divChildren.map((child) => (
                    <div key={child.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`child-${child.id}`}
                        checked={attendees.has(child.id)}
                        onCheckedChange={() => toggleAttendee(child.id)}
                      />
                      <label
                        htmlFor={`child-${child.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {child.name} {child.age ? `(${child.age})` : ""}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="filter" className="space-y-4">
            <div>
              <Label>Filter by Division</Label>
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="w-full px-4 py-2 border rounded-md bg-background"
              >
                <option value="all">All Divisions</option>
                {divisions.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              <Label className="flex items-center gap-2">
                Selected Campers
                <Badge>{attendees.size} selected</Badge>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {filteredChildren.map((child) => (
                  <div key={child.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filtered-${child.id}`}
                      checked={attendees.has(child.id)}
                      onCheckedChange={() => toggleAttendee(child.id)}
                    />
                    <label
                      htmlFor={`filtered-${child.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {child.name} - {child.division?.name || "No Division"}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Total selected: {attendees.size} campers
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Roster"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
