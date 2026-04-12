import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { staffSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Radio, CheckCircle2 } from "lucide-react";
import { sortDivisionsAlternatingGender, Division } from "@/lib/divisionUtils";

interface EditStaffDialogProps {
  staffId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditStaffDialog({ staffId, open, onOpenChange, onSuccess }: EditStaffDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [staffType, setStaffType] = useState<string>("");
  const [session, setSession] = useState<string>("");
  const [rfidValue, setRfidValue] = useState("");
  const [rfidJustScanned, setRfidJustScanned] = useState(false);
  const [tshirtSize, setTshirtSize] = useState<string>("");
  const [divisionId, setDivisionId] = useState<string>("");
  const rfidInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && staffId) {
      fetchStaff();
      fetchSupervisors();
      fetchDivisions();
    }
  }, [open, staffId, currentSeason]);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("id", staffId)
      .single();

    if (!error && data) {
      setStaff(data);
      setLeaderId(data.leader_id || "");
      setStaffType(data.staff_type || "");
      setSession(data.session || "");
      setRfidValue(data.rfid || "");
      setTshirtSize(data.tshirt_size || "");
      setDivisionId(data.division_id || "");
    }
  };

  const fetchSupervisors = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .in("role", ["Director", "Supervisor", "Manager"])
      .neq("id", staffId)
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        name: formData.get("name") as string,
        person_id: staff.person_id || staff.id, // Use existing person_id or fallback to id
        role: formData.get("role") as string,
        department: formData.get("department") as string || null,
        email: formData.get("email") as string || null,
        phone: formData.get("phone") as string || null,
        hire_date: formData.get("hire_date") as string || null,
        date_of_birth: formData.get("date_of_birth") as string || null,
        season: formData.get("season") as string || null,
        session: session || null,
        leader_id: leaderId || null,
        staff_type: staffType || null,
        allergies: formData.get("allergies") as string || null,
        rfid: rfidValue || null,
        tshirt_size: tshirtSize || null,
        division_id: divisionId || null,
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
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={staff.date_of_birth || ""} />
          </div>
          <div>
            <Label htmlFor="season">Season (Year)</Label>
            <Input id="season" name="season" defaultValue={staff.season || ""} placeholder="e.g., 2024" maxLength={4} />
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
          <Select value={tshirtSize || "none"} onValueChange={(val) => setTshirtSize(val === "none" ? "" : val)}>
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
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea 
              id="allergies" 
              name="allergies" 
              placeholder="List any allergies (optional)"
              defaultValue={staff.allergies || ""}
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
          <div className={`p-3 rounded-lg border-2 transition-all ${rfidJustScanned ? 'border-green-500 bg-green-50 dark:bg-green-950/30' : 'border-transparent'}`}>
            <Label htmlFor="rfid" className="flex items-center gap-2">
              <Radio className={`h-4 w-4 ${rfidJustScanned ? 'text-green-600 animate-pulse' : 'text-muted-foreground'}`} />
              RFID Wristband
              {rfidValue && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </Label>
            <Input 
              ref={rfidInputRef}
              id="rfid" 
              name="rfid" 
              value={rfidValue}
              onChange={(e) => {
                setRfidValue(e.target.value);
                if (e.target.value && e.target.value !== staff?.rfid) {
                  setRfidJustScanned(true);
                  setTimeout(() => setRfidJustScanned(false), 2000);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const form = e.currentTarget.form;
                  if (form) {
                    const inputs = Array.from(form.querySelectorAll('input, textarea, select, button'));
                    const index = inputs.indexOf(e.currentTarget);
                    const next = inputs[index + 1] as HTMLElement;
                    next?.focus();
                  }
                  if (rfidValue) {
                    toast.success("Wristband scanned!", {
                      description: `RFID: ${rfidValue.slice(0, 8)}...`
                    });
                  }
                }
              }}
              placeholder="Scan wristband or enter RFID..." 
              className={rfidJustScanned ? 'border-green-500 ring-2 ring-green-500/20' : ''}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Scan the staff member's ISO 14443 Type A wristband
            </p>
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
