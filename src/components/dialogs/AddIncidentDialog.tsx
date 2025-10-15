import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddIncidentDialog({ open, onOpenChange, onSuccess }: AddIncidentDialogProps) {
  const [children, setChildren] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    child_id: "",
    date: new Date().toISOString().split('T')[0],
    type: "",
    description: "",
    severity: "medium",
    reported_by: "",
    status: "open",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchChildren();
    }
  }, [open]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase
      .from("incident_reports")
      .insert(formData);

    if (error) {
      toast({ title: "Error adding incident", variant: "destructive" });
      return;
    }

    toast({ title: "Incident report added successfully" });
    setFormData({
      child_id: "",
      date: new Date().toISOString().split('T')[0],
      type: "",
      description: "",
      severity: "medium",
      reported_by: "",
      status: "open",
    });
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Incident Report</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Child</Label>
            <Select value={formData.child_id} onValueChange={(value) => setFormData({ ...formData, child_id: value })}>
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
            <Label>Reported By</Label>
            <Input
              value={formData.reported_by}
              onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
              placeholder="Staff member name"
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
            <Button type="submit">Add Incident</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
