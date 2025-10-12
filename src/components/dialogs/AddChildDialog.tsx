import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function AddChildDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      age: parseInt(formData.get("age") as string) || null,
      grade: formData.get("grade") as string,
      group_name: formData.get("group_name") as string,
      guardian_email: formData.get("guardian_email") as string,
      guardian_phone: formData.get("guardian_phone") as string,
      allergies: formData.get("allergies") as string,
      medical_notes: formData.get("medical_notes") as string,
      emergency_contact: formData.get("emergency_contact") as string,
    };

    const { error } = await supabase.from("children").insert([data]);

    if (error) {
      toast.error("Failed to add child");
      console.error(error);
    } else {
      toast.success("Child added successfully");
      setOpen(false);
      onSuccess?.();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Child
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Child</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" name="age" type="number" />
            </div>
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Input id="grade" name="grade" />
            </div>
            <div>
              <Label htmlFor="group_name">Group</Label>
              <Input id="group_name" name="group_name" />
            </div>
            <div>
              <Label htmlFor="guardian_email">Guardian Email</Label>
              <Input id="guardian_email" name="guardian_email" type="email" />
            </div>
            <div>
              <Label htmlFor="guardian_phone">Guardian Phone</Label>
              <Input id="guardian_phone" name="guardian_phone" type="tel" />
            </div>
          </div>
          <div>
            <Label htmlFor="emergency_contact">Emergency Contact</Label>
            <Input id="emergency_contact" name="emergency_contact" />
          </div>
          <div>
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea id="allergies" name="allergies" />
          </div>
          <div>
            <Label htmlFor="medical_notes">Medical Notes</Label>
            <Textarea id="medical_notes" name="medical_notes" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Child"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
