import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Search } from "lucide-react";

interface AddIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddIncidentDialog({ open, onOpenChange, onSuccess }: AddIncidentDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [childSearch, setChildSearch] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [formData, setFormData] = useState({
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
  }, [open, currentSeason]);

  const fetchChildren = async () => {
    if (!currentCompany?.id) return;
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("name");

    if (!error && data) {
      setChildren(data);
    }
  };

  const filteredChildren = useMemo(() => {
    if (!childSearch.trim()) return children;
    const searchLower = childSearch.toLowerCase();
    return children.filter(child => 
      child.name.toLowerCase().includes(searchLower)
    );
  }, [children, childSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedChildren.length === 0) {
      toast({ title: "Please select at least one child", variant: "destructive" });
      return;
    }

    if (!formData.type) {
      toast({ title: "Please select an incident type", variant: "destructive" });
      return;
    }

    const { data: incident, error: incidentError } = await supabase
      .from("incident_reports")
      .insert({ ...formData, tags, company_id: currentCompany?.id, season: currentSeason })
      .select()
      .single();

    if (incidentError || !incident) {
      toast({ title: "Error adding incident", variant: "destructive" });
      return;
    }

    const childrenInserts = selectedChildren.map(child_id => ({
      incident_id: incident.id,
      child_id
    }));

    const { error: childrenError } = await supabase
      .from("incident_children")
      .insert(childrenInserts);

    if (childrenError) {
      toast({ title: "Error linking children to incident", variant: "destructive" });
      return;
    }

    toast({ title: "Incident report added successfully" });
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: "",
      description: "",
      severity: "medium",
      reported_by: "",
      status: "open",
    });
    setSelectedChildren([]);
    setChildSearch("");
    setTags([]);
    setTagInput("");
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
          <DialogTitle>Add Incident Report</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Children Involved *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={childSearch}
                onChange={(e) => setChildSearch(e.target.value)}
                placeholder="Search children..."
                className="pl-9"
              />
            </div>
            <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
              {filteredChildren.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  {childSearch ? "No children found" : "No children available"}
                </p>
              ) : (
                filteredChildren.map((child) => (
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
                ))
              )}
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
            <Label>Reported By</Label>
            <Input
              value={formData.reported_by}
              onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
              placeholder="Enter reporter name"
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
