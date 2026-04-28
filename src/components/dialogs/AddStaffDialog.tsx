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
import { sortDivisionsAlternatingGender, Division } from "@/lib/divisionUtils";

export default function AddStaffDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [bunks, setBunks] = useState<Array<{ id: string; bunk_number: number; bunk_name: string | null }>>([]);
  const [leaderId, setLeaderId] = useState("");
  const [staffType, setStaffType] = useState<string>("");
  const [session, setSession] = useState<string>("");
  const [divisionId, setDivisionId] = useState<string>("");
  const [bunkId, setBunkId] = useState<string>("");
  const [showAddBunkDialog, setShowAddBunkDialog] = useState(false);
  const [newBunkNumber, setNewBunkNumber] = useState("");
  const [newBunkName, setNewBunkName] = useState("");
  const [addingBunk, setAddingBunk] = useState(false);
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();

  useEffect(() => {
    if (open) {
      fetchSupervisors();
      fetchDivisions();
      fetchBunks();
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

  const fetchDivisions = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true)
      .order("sort_order");
    setDivisions(sortDivisionsAlternatingGender(data || []));
  };

  const fetchBunks = async () => {
    if (!currentCompany?.id) return;

    let query = supabase
      .from("bunks")
      .select("id, bunk_number, bunk_name")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true)
      .order("bunk_number", { ascending: true });

    if (currentSeason) {
      query = query.eq("season", currentSeason);
    }

    const { data } = await query;
    setBunks(data || []);
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
        division_id: divisionId || null,
      };

      const validatedData = staffSchema.parse(data) as Record<string, any>;

      const insertData = {
        ...validatedData,
        company_id: currentCompany?.id,
        season: currentSeason,
      } as any;

      const { data: insertedStaff, error } = await supabase
        .from("staff")
        .insert([insertData])
        .select("id")
        .single();

      if (error) {
        toast.error("Failed to add staff member");
        console.error(error);
      } else {
        if (bunkId && insertedStaff?.id && currentCompany?.id) {
          const { error: bunkAssignError } = await supabase.from("bunk_staff").insert([
            {
              bunk_id: bunkId,
              staff_id: insertedStaff.id,
              company_id: currentCompany.id,
              season: currentSeason,
              is_primary: true,
            },
          ]);

          if (bunkAssignError) {
            toast.warning("Staff created, but bunk assignment failed");
            console.error(bunkAssignError);
          }
        }

        toast.success("Staff member added successfully");
        setOpen(false);
        setLeaderId("");
        setStaffType("");
        setSession("");
        setDivisionId("");
        setBunkId("");
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

  const handleAddBunk = async () => {
    if (!currentCompany?.id) return;

    const bunkNumber = Number(newBunkNumber);
    if (!Number.isInteger(bunkNumber) || bunkNumber <= 0) {
      toast.error("Please enter a valid bunk number");
      return;
    }

    setAddingBunk(true);
    try {
      const { data, error } = await supabase
        .from("bunks")
        .insert([
          {
            company_id: currentCompany.id,
            season: currentSeason,
            bunk_number: bunkNumber,
            bunk_name: newBunkName.trim() || null,
            is_active: true,
          },
        ])
        .select("id, bunk_number, bunk_name")
        .single();

      if (error) {
        toast.error("Failed to add bunk");
        console.error(error);
        return;
      }

      if (data) {
        setBunks((prev) => [...prev, data].sort((a, b) => a.bunk_number - b.bunk_number));
        setBunkId(data.id);
      }

      toast.success("Bunk added");
      setShowAddBunkDialog(false);
      setNewBunkNumber("");
      setNewBunkName("");
    } finally {
      setAddingBunk(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Staff Member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
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
            <Label>T-Shirt Size</Label>
            <Select value={staffType === '' && !session ? 'none' : undefined} onValueChange={(val) => {
              const form = document.getElementById('tshirt_size') as HTMLInputElement;
              if (form) form.value = val === 'none' ? '' : val;
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not Specified</SelectItem>
                <SelectItem value="Youth S">Youth S</SelectItem>
                <SelectItem value="Youth M">Youth M</SelectItem>
                <SelectItem value="Youth L">Youth L</SelectItem>
                <SelectItem value="Youth XL">Youth XL</SelectItem>
                <SelectItem value="Adult XS">Adult XS</SelectItem>
                <SelectItem value="Adult S">Adult S</SelectItem>
                <SelectItem value="Adult M">Adult M</SelectItem>
                <SelectItem value="Adult L">Adult L</SelectItem>
                <SelectItem value="Adult XL">Adult XL</SelectItem>
                <SelectItem value="Adult 2XL">Adult 2XL</SelectItem>
                <SelectItem value="Adult 3XL">Adult 3XL</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" id="tshirt_size" name="tshirt_size" />
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
            <Label>Division</Label>
            <Select value={divisionId || "none"} onValueChange={(val) => setDivisionId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Division</SelectItem>
                {divisions.map((division) => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.name} ({division.gender})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Bunk</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddBunkDialog(true)}>
                Add Bunk
              </Button>
            </div>
            <Select value={bunkId || "none"} onValueChange={(val) => setBunkId(val === "none" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select bunk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Bunk</SelectItem>
                {bunks.map((bunk) => (
                  <SelectItem key={bunk.id} value={bunk.id}>
                    Bunk {bunk.bunk_number}
                    {bunk.bunk_name ? ` - ${bunk.bunk_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
    <Dialog open={showAddBunkDialog} onOpenChange={setShowAddBunkDialog}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add Bunk</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bunk_number">Bunk Number *</Label>
            <Input
              id="bunk_number"
              type="number"
              min={1}
              value={newBunkNumber}
              onChange={(e) => setNewBunkNumber(e.target.value)}
              placeholder="e.g., 12"
            />
          </div>
          <div>
            <Label htmlFor="bunk_name">Bunk Name</Label>
            <Input
              id="bunk_name"
              value={newBunkName}
              onChange={(e) => setNewBunkName(e.target.value)}
              placeholder="Optional (e.g., Cabin A)"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAddBunkDialog(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={addingBunk} onClick={() => void handleAddBunk()}>
              {addingBunk ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
