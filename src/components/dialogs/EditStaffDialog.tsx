import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { staffSchema } from "@/lib/validationSchemas";
import { z } from "zod";

interface EditStaffDialogProps {
  staffId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditStaffDialog({ staffId, open, onOpenChange, onSuccess }: EditStaffDialogProps) {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [leaderId, setLeaderId] = useState("");

  useEffect(() => {
    if (open && staffId) {
      fetchStaff();
      fetchSupervisors();
    }
  }, [open, staffId]);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("id", staffId)
      .single();

    if (!error && data) {
      setStaff(data);
      setLeaderId(data.leader_id || "");
    }
  };

  const fetchSupervisors = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .in("role", ["Director", "Supervisor", "Manager"])
      .neq("id", staffId)
      .order("name");
    setSupervisors(data || []);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        name: formData.get("name") as string,
        role: formData.get("role") as string,
        department: formData.get("department") as string || null,
        email: formData.get("email") as string || null,
        phone: formData.get("phone") as string || null,
        hire_date: formData.get("hire_date") as string || null,
        season: formData.get("season") as string || null,
        leader_id: leaderId || null,
      };

      const validatedData = staffSchema.parse(data);

      const { error } = await supabase
        .from("staff")
        .update(validatedData)
        .eq("id", staffId);

      if (error) {
        toast.error("Failed to update staff member");
        console.error(error);
      } else {
        toast.success("Staff member updated successfully");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to update staff member");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!staff) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" defaultValue={staff.name} required />
          </div>
          <div>
            <Label htmlFor="role">Role *</Label>
            <Input id="role" name="role" defaultValue={staff.role} required />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" defaultValue={staff.department || ""} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={staff.email || ""} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={staff.phone || ""} />
          </div>
          <div>
            <Label htmlFor="hire_date">Hire Date</Label>
            <Input id="hire_date" name="hire_date" type="date" defaultValue={staff.hire_date || ""} />
          </div>
          <div>
            <Label htmlFor="season">Season (Year)</Label>
            <Input id="season" name="season" defaultValue={staff.season || ""} placeholder="e.g., 2024" maxLength={4} />
          </div>
          <div>
            <Label>Reports To (Supervisor)</Label>
            <Select value={leaderId} onValueChange={setLeaderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select supervisor" />
              </SelectTrigger>
              <SelectContent>
                {supervisors.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} - {member.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
