import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";

interface ManageSportsRosterDialogProps {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageSportsRosterDialog({
  eventId,
  eventTitle,
  open,
  onOpenChange,
}: ManageSportsRosterDialogProps) {
  const [children, setChildren] = useState<any[]>([]);
  const [roster, setRoster] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "age" | "grade">("name");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, eventId]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all active children
    const { data: childrenData, error: childrenError } = await supabase
      .from("children")
      .select("*")
      .eq("status", "active")
      .order("name");

    if (childrenError) {
      toast.error("Failed to load children");
      setLoading(false);
      return;
    }

    // Fetch existing roster
    const { data: rosterData, error: rosterError } = await supabase
      .from("sports_event_roster")
      .select("child_id")
      .eq("event_id", eventId);

    if (rosterError) {
      toast.error("Failed to load roster");
      setLoading(false);
      return;
    }

    setChildren(childrenData || []);
    setRoster(new Set(rosterData?.map(r => r.child_id) || []));
    setLoading(false);
  };

  const handleToggle = (childId: string) => {
    const newRoster = new Set(roster);
    if (newRoster.has(childId)) {
      newRoster.delete(childId);
    } else {
      newRoster.add(childId);
    }
    setRoster(newRoster);
  };

  const handleSave = async () => {
    setSaving(true);

    // Delete all existing roster entries for this event
    const { error: deleteError } = await supabase
      .from("sports_event_roster")
      .delete()
      .eq("event_id", eventId);

    if (deleteError) {
      toast.error("Failed to update roster");
      setSaving(false);
      return;
    }

    // Insert new roster entries
    if (roster.size > 0) {
      const rosterEntries = Array.from(roster).map(childId => ({
        event_id: eventId,
        child_id: childId,
        confirmed: false,
      }));

      const { error: insertError } = await supabase
        .from("sports_event_roster")
        .insert(rosterEntries);

      if (insertError) {
        toast.error("Failed to save roster");
        setSaving(false);
        return;
      }
    }

    toast.success(`Roster updated: ${roster.size} ${roster.size === 1 ? 'camper' : 'campers'} selected`);
    setSaving(false);
    onOpenChange(false);
  };

  const filteredAndSortedChildren = children
    .filter(child => 
      child.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "age") {
        return (a.age || 0) - (b.age || 0);
      } else if (sortBy === "grade") {
        return (a.grade || "").localeCompare(b.grade || "");
      }
      return 0;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Roster: {eventTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Search Campers</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>Sort By</Label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border rounded-md bg-background"
              >
                <option value="name">Name</option>
                <option value="age">Age</option>
                <option value="grade">Grade</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {roster.size} of {filteredAndSortedChildren.length} campers selected
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto border rounded-md p-4 space-y-2">
              {filteredAndSortedChildren.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
                >
                  <Checkbox
                    id={child.id}
                    checked={roster.has(child.id)}
                    onCheckedChange={() => handleToggle(child.id)}
                  />
                  <label
                    htmlFor={child.id}
                    className="flex-1 cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-medium">{child.name}</span>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      {child.age && <span>Age: {child.age}</span>}
                      {child.grade && <span>Grade: {child.grade}</span>}
                      {child.group_name && <span>Group: {child.group_name}</span>}
                    </div>
                  </label>
                </div>
              ))}
              {filteredAndSortedChildren.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No campers found
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? "Saving..." : "Save Roster"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
