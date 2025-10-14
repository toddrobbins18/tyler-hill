import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditNoteDialogProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EditNoteDialog({ noteId, open, onOpenChange, onSuccess }: EditNoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    child_id: "",
    date: "",
    mood: "",
    meals: "",
    nap: "",
    activities: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchNote();
      fetchChildren();
    }
  }, [open, noteId]);

  const fetchNote = async () => {
    const { data, error } = await supabase
      .from("daily_notes")
      .select("*")
      .eq("id", noteId)
      .single();

    if (!error && data) {
      setFormData({
        child_id: data.child_id || "",
        date: data.date || "",
        mood: data.mood || "",
        meals: data.meals || "",
        nap: data.nap || "",
        activities: data.activities || "",
        notes: data.notes || "",
      });
    }
  };

  const fetchChildren = async () => {
    const { data } = await supabase
      .from("children")
      .select("id, name")
      .eq("status", "active")
      .order("name");
    
    if (data) setChildren(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("daily_notes")
      .update(formData)
      .eq("id", noteId);

    if (error) {
      toast.error("Failed to update note");
      console.error(error);
    } else {
      toast.success("Note updated successfully");
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Daily Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="child">Child</Label>
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

          <div>
            <Label htmlFor="mood">Mood</Label>
            <Input
              id="mood"
              value={formData.mood}
              onChange={(e) => setFormData({ ...formData, mood: e.target.value })}
              placeholder="Happy, Energetic, etc."
            />
          </div>

          <div>
            <Label htmlFor="meals">Meals</Label>
            <Textarea
              id="meals"
              value={formData.meals}
              onChange={(e) => setFormData({ ...formData, meals: e.target.value })}
              placeholder="What did they eat?"
            />
          </div>

          <div>
            <Label htmlFor="nap">Nap</Label>
            <Input
              id="nap"
              value={formData.nap}
              onChange={(e) => setFormData({ ...formData, nap: e.target.value })}
              placeholder="Nap duration"
            />
          </div>

          <div>
            <Label htmlFor="activities">Activities</Label>
            <Textarea
              id="activities"
              value={formData.activities}
              onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
              placeholder="What activities did they do?"
            />
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any other observations?"
            />
          </div>

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
