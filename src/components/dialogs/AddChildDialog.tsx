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
import { childSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { useCompany } from "@/contexts/CompanyContext";

export default function AddChildDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [gender, setGender] = useState("");
  const { currentCompany } = useCompany();

  useEffect(() => {
    if (open) {
      fetchStaff();
      fetchDivisions();
    }
  }, [open]);

  const fetchStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .order("name");
    setStaff(data || []);
  };

  const fetchDivisions = async () => {
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");
    setDivisions(data || []);
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
        season: formData.get("season") as string || null,
        division_id: divisionId || null,
        leader_id: leaderId || null,
        guardian_email: formData.get("guardian_email") as string || null,
        guardian_phone: formData.get("guardian_phone") as string || null,
        emergency_contact: formData.get("emergency_contact") as string || null,
        allergies: formData.get("allergies") as string || null,
        medical_notes: formData.get("medical_notes") as string || null,
      };

      const validatedData = childSchema.parse(data) as {
        name: string;
        age?: number | null;
        gender?: string | null;
        category?: string | null;
        grade?: string | null;
        group_name?: string | null;
        leader_id?: string | null;
        guardian_email?: string | null;
        guardian_phone?: string | null;
        emergency_contact?: string | null;
        allergies?: string | null;
        medical_notes?: string | null;
      };

      const { error } = await supabase.from("children").insert([{
        ...validatedData,
        company_id: currentCompany?.id
      }]);

      if (error) {
        toast.error("Failed to add child");
        console.error(error);
      } else {
        toast.success("Child added successfully");
        setOpen(false);
        setGender("");
        setLeaderId("");
        setDivisionId("");
        onSuccess?.();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Failed to add child");
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
              <Label>Division</Label>
              <Select value={divisionId} onValueChange={setDivisionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {divisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label htmlFor="season">Season (Year)</Label>
              <Input id="season" name="season" placeholder="e.g., 2024" maxLength={4} />
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
