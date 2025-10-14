import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { childSchema } from "@/lib/validationSchemas";
import { z } from "zod";

interface EditChildDialogProps {
  childId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditChildDialog({ childId, open, onOpenChange, onSuccess }: EditChildDialogProps) {
  const [loading, setLoading] = useState(false);
  const [child, setChild] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [gender, setGender] = useState("");

  useEffect(() => {
    if (open && childId) {
      fetchChild();
      fetchStaff();
    }
  }, [open, childId]);

  const fetchChild = async () => {
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("id", childId)
      .single();

    if (!error && data) {
      setChild(data);
      setGender(data.gender || "");
      setLeaderId(data.leader_id || "");
    }
  };

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .order("name");
    setStaff(data || []);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        name: formData.get("name") as string,
        age: formData.get("age") ? parseInt(formData.get("age") as string) : null,
        gender: gender || null,
        category: formData.get("category") as string || null,
        grade: formData.get("grade") as string || null,
        group_name: formData.get("group_name") as string || null,
        leader_id: leaderId || null,
        guardian_email: formData.get("guardian_email") as string || null,
        guardian_phone: formData.get("guardian_phone") as string || null,
        emergency_contact: formData.get("emergency_contact") as string || null,
        allergies: formData.get("allergies") as string || null,
        medical_notes: formData.get("medical_notes") as string || null,
      };

      const validatedData = childSchema.parse(data);

      const { error } = await supabase
        .from("children")
        .update(validatedData)
        .eq("id", childId);

      if (error) {
        toast.error("Failed to update child");
        console.error(error);
      } else {
        toast.success("Child updated successfully");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to update child");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!child) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Child</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" defaultValue={child.name} required />
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" name="age" type="number" defaultValue={child.age || ""} />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" defaultValue={child.category || ""} placeholder="e.g., Freshman Boys" />
            </div>
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Input id="grade" name="grade" defaultValue={child.grade || ""} />
            </div>
            <div>
              <Label htmlFor="group_name">Group</Label>
              <Input id="group_name" name="group_name" defaultValue={child.group_name || ""} />
            </div>
            <div className="col-span-2">
              <Label>Assigned Leader</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a leader" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} - {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="guardian_email">Guardian Email</Label>
              <Input id="guardian_email" name="guardian_email" type="email" defaultValue={child.guardian_email || ""} />
            </div>
            <div>
              <Label htmlFor="guardian_phone">Guardian Phone</Label>
              <Input id="guardian_phone" name="guardian_phone" type="tel" defaultValue={child.guardian_phone || ""} />
            </div>
          </div>
          <div>
            <Label htmlFor="emergency_contact">Emergency Contact</Label>
            <Input id="emergency_contact" name="emergency_contact" defaultValue={child.emergency_contact || ""} />
          </div>
          <div>
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea id="allergies" name="allergies" defaultValue={child.allergies || ""} />
          </div>
          <div>
            <Label htmlFor="medical_notes">Medical Notes</Label>
            <Textarea id="medical_notes" name="medical_notes" defaultValue={child.medical_notes || ""} />
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
