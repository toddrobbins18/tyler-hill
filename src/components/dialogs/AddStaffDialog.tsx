import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { staffSchema } from "@/lib/validationSchemas";
import { z } from "zod";

export default function AddStaffDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [leaderId, setLeaderId] = useState("");

  useEffect(() => {
    if (open) {
      fetchSupervisors();
    }
  }, [open]);

  const fetchSupervisors = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .in("role", ["Director", "Supervisor", "Manager"])
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
        leader_id: leaderId || null,
      };

      const validatedData = staffSchema.parse(data) as {
        name: string;
        role: string;
        department?: string | null;
        email?: string | null;
        phone?: string | null;
        hire_date?: string | null;
        leader_id?: string | null;
      };

      const { error } = await supabase.from("staff").insert([validatedData]);

      if (error) {
        toast.error("Failed to add staff member");
        console.error(error);
      } else {
        toast.success("Staff member added successfully");
        setOpen(false);
        setLeaderId("");
        onSuccess?.();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to add staff member");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="role">Role *</Label>
            <Input id="role" name="role" required />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input id="department" name="department" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
          <div>
            <Label htmlFor="hire_date">Hire Date</Label>
            <Input id="hire_date" name="hire_date" type="date" />
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Staff"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
