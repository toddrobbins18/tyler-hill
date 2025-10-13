import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  useEffect(() => {
    if (open && staffId) {
      fetchStaff();
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
    }
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
