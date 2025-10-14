import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddNoteDialogProps {
  onSuccess: () => void;
}

export default function AddNoteDialog({ onSuccess }: AddNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    child_id: "",
    date: new Date().toISOString().split('T')[0],
    mood: "",
    meals: "",
    nap: "",
    activities: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchChildren();
    }
  }, [open]);

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

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("daily_notes")
      .insert([{ ...formData, created_by: user?.id }]);

    if (error) {
      toast.error("Failed to add note");
      console.error(error);
    } else {
      toast.success("Note added successfully");
      onSuccess();
      setOpen(false);
      setFormData({
        child_id: "",
        date: new Date().toISOString().split('T')[0],
        mood: "",
        meals: "",
        nap: "",
        activities: "",
        notes: "",
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Daily Note</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="child">Child</Label>
            <Select value={formData.child_id} onValueChange={(value) => setFormData({ ...formData, child_id: value })} required>
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
              placeholder="Nap duration (e.g., 1 hour)"
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
