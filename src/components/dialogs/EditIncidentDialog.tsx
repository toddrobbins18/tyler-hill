import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: any;
  onSuccess: () => void;
}

export default function EditIncidentDialog({ open, onOpenChange, incident, onSuccess }: EditIncidentDialogProps) {
  const [children, setChildren] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [formData, setFormData] = useState({
    date: "",
    type: "",
    description: "",
    severity: "medium",
    reporter_id: "",
    reported_by: "",
    status: "open",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchChildren();
      fetchStaff();
    }
  }, [open]);

  useEffect(() => {
    if (incident && open) {
      setFormData({
        date: incident.date,
        type: incident.type,
        description: incident.description,
        severity: incident.severity || "medium",
        reporter_id: incident.reporter_id || "",
        reported_by: incident.reported_by || "",
        status: incident.status || "open",
      });
      setTags(incident.tags || []);
      fetchIncidentChildren();
    }
  }, [incident, open]);

  const fetchChildren = async () => {
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("status", "active")
      .order("name");

    if (!error && data) {
      setChildren(data);
    }
  };

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("status", "active")
      .order("name");

    if (!error && data) {
      setStaff(data);
    }
  };

  const fetchIncidentChildren = async () => {
    if (!incident?.id) return;

    const { data, error } = await supabase
      .from("incident_children")
      .select("child_id")
      .eq("incident_id", incident.id);

    if (!error && data) {
      setSelectedChildren(data.map(ic => ic.child_id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedChildren.length === 0) {
      toast({ title: "Please select at least one child", variant: "destructive" });
      return;
    }

    const { error: updateError } = await supabase
      .from("incident_reports")
      .update({ ...formData, tags })
      .eq("id", incident.id);

    if (updateError) {
      toast({ title: "Error updating incident", variant: "destructive" });
      return;
    }

    // Delete existing children links
    await supabase
      .from("incident_children")
      .delete()
      .eq("incident_id", incident.id);

    // Insert new children links
    const childrenInserts = selectedChildren.map(child_id => ({
      incident_id: incident.id,
      child_id
    }));

    const { error: childrenError } = await supabase
      .from("incident_children")
      .insert(childrenInserts);

    if (childrenError) {
      toast({ title: "Error updating children", variant: "destructive" });
      return;
    }

    toast({ title: "Incident updated successfully" });
    onSuccess();
    onOpenChange(false);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const toggleChildSelection = (childId: string) => {
    setSelectedChildren(prev =>
      prev.includes(childId)
        ? prev.filter(id => id !== childId)
        : [...prev, childId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Incident Report</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Children Involved *</Label>
            <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
              {children.map((child) => (
                <div key={child.id} className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    id={`child-${child.id}`}
                    checked={selectedChildren.includes(child.id)}
                    onChange={() => toggleChildSelection(child.id)}
                    className="rounded"
                  />
                  <label htmlFor={`child-${child.id}`} className="cursor-pointer flex-1">
                    {child.name}
                  </label>
                </div>
              ))}
            </div>
            {selectedChildren.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedChildren.length} child{selectedChildren.length > 1 ? 'ren' : ''} selected
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select incident type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="injury">Injury</SelectItem>
                <SelectItem value="behavioral">Behavioral</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={formData.severity} onValueChange={(value) => setFormData({ ...formData, severity: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the incident..."
              required
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Tags (Optional)</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag (e.g., Verbal, Physical, Friendship)"
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Staff Reporter</Label>
            <Select value={formData.reporter_id} onValueChange={(value) => setFormData({ ...formData, reporter_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reported By (External)</Label>
            <Input
              value={formData.reported_by}
              onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
              placeholder="External reporter name (if not staff)"
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Update Incident</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
