import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { staffSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";

export default function AddStaffDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [staffType, setStaffType] = useState<string>("");
  const [session, setSession] = useState<string>("");
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();

  useEffect(() => {
    if (open) {
      fetchSupervisors();
    }
  }, [open, currentSeason]);

  const fetchSupervisors = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
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
        season: formData.get("season") as string || null,
        session: session || null,
        leader_id: leaderId || null,
        staff_type: staffType || null,
        allergies: formData.get("allergies") as string || null,
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

      const { error } = await supabase.from("staff").insert([{
        ...validatedData,
        company_id: currentCompany?.id,
        season: currentSeason
      }]);

      if (error) {
        toast.error("Failed to add staff member");
        console.error(error);
      } else {
        toast.success("Staff member added successfully");
        setOpen(false);
        setLeaderId("");
        setStaffType("");
        setSession("");
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
            <Label htmlFor="season">Season (Year)</Label>
            <Input id="season" name="season" placeholder="e.g., 2024" maxLength={4} defaultValue={currentSeason} />
          </div>
          {currentCompany?.slug === 'timber-lake-west' && (
            <div>
              <Label>Session</Label>
              <Select value={session || "none"} onValueChange={(val) => setSession(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Specified</SelectItem>
                  <SelectItem value="First Session">First Session</SelectItem>
                  <SelectItem value="Second Session">Second Session</SelectItem>
                  <SelectItem value="First Session, Second Session">Both Sessions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Staff Type</Label>
            <Select value={staffType || "none"} onValueChange={(val) => setStaffType(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not Specified</SelectItem>
                <SelectItem value="general_counselor">General Counselor</SelectItem>
                <SelectItem value="specialist">Specialist</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Allergies</Label>
            <Textarea 
              id="allergies" 
              name="allergies" 
              placeholder="List any allergies (optional)"
              className="min-h-[80px]"
            />
          </div>
          <div>
            <Label>Reports To (Supervisor)</Label>
            <Select value={leaderId || "none"} onValueChange={(val) => setLeaderId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Supervisor</SelectItem>
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
