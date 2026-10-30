import { useState, useEffect, useRef } from "react";
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
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";
import { dedupeDivisionsForDropdown, getDivisionDropdownLabel } from "@/lib/divisionFilterUtils";
import { normalizeRfidInput } from "@/lib/rfidUtils";
import { isDayCampCompany } from "@/lib/camps";
import { camperAssignmentLabel } from "@/lib/camperGroupDisplay";
import { Radio, CheckCircle2 } from "lucide-react";

interface EditChildDialogProps {
  childId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditChildDialog({ childId, open, onOpenChange, onSuccess }: EditChildDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const isDayCamp = isDayCampCompany(currentCompany);
  const assignmentLabel = camperAssignmentLabel(isDayCamp);
  const [loading, setLoading] = useState(false);
  const [child, setChild] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [bunks, setBunks] = useState<any[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [bunkId, setBunkId] = useState("");
  const [gender, setGender] = useState("");
  const [session, setSession] = useState("");
  const [rfidValue, setRfidValue] = useState("");
  const [rfidJustScanned, setRfidJustScanned] = useState(false);
  const [tshirtSize, setTshirtSize] = useState<string>("");
  const rfidInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && childId) {
      fetchChild();
      fetchStaff();
      fetchDivisions();
      fetchBunks();
    }
  }, [open, childId, currentSeason]);

  const fetchChild = async () => {
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("id", childId)
      .single();

    if (!error && data) {
      setChild(data);
      setGender(data.gender || "");
      setSession(data.session || "");
      setLeaderId(data.leader_id || "");
      setDivisionId(data.division_id || "");
      setRfidValue(data.rfid || "");
      setBunkId(data.bunk_id || "");
      setTshirtSize(data.tshirt_size || "");
    }
  };

  const fetchStaff = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("name");
    setStaff(data || []);
  };

  const fetchDivisions = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true);
    setDivisions(dedupeDivisionsForDropdown(sortDivisionsAlternatingGender(data || [])));
  };

  const fetchBunks = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("bunks")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true)
      .order("bunk_number");
    setBunks(data || []);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      let groupName = (formData.get("group_name") as string) || null;
      if (isDayCamp) {
        const selectedBunk = bunks.find((b) => b.id === bunkId);
        groupName =
          bunkId && bunkId !== "none"
            ? selectedBunk?.bunk_name?.trim() ||
              (selectedBunk?.bunk_number != null ? `${assignmentLabel} ${selectedBunk.bunk_number}` : null)
            : null;
      }
      const data = {
        name: formData.get("name") as string,
        person_id: formData.get("person_id") as string,
        age: formData.get("age") ? parseInt(formData.get("age") as string) : null,
        date_of_birth: formData.get("date_of_birth") as string || null,
        gender: gender || null,
        category: formData.get("category") as string || null,
        grade: formData.get("grade") as string || null,
        group_name: groupName,
        season: formData.get("season") as string || null,
        session: session || null,
        division_id: divisionId || null,
        bunk_id: bunkId && bunkId !== "none" ? bunkId : null,
        leader_id: leaderId || null,
        guardian_email: formData.get("guardian_email") as string || null,
        guardian_phone: formData.get("guardian_phone") as string || null,
        emergency_contact: formData.get("emergency_contact") as string || null,
        allergies: formData.get("allergies") as string || null,
        medical_notes: formData.get("medical_notes") as string || null,
        rfid: normalizeRfidInput(rfidValue) || null,
        tshirt_size: tshirtSize || null,
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
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={child.date_of_birth || ""} />
            </div>
            <div>
              <Label htmlFor="person_id">Person ID *</Label>
              <Input id="person_id" name="person_id" defaultValue={child.person_id || ""} required />
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
                      {getDivisionDropdownLabel(division.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{assignmentLabel}</Label>
              <Select value={bunkId} onValueChange={setBunkId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${assignmentLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No {assignmentLabel} Assigned</SelectItem>
                  {bunks.map((bunk) => (
                    <SelectItem key={bunk.id} value={bunk.id}>
                      {bunk.bunk_name || `${assignmentLabel} ${bunk.bunk_number}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Input id="grade" name="grade" defaultValue={child.grade || ""} />
            </div>
            {!isDayCamp && (
              <div>
                <Label htmlFor="group_name">Team</Label>
                <Input id="group_name" name="group_name" defaultValue={child.group_name || ""} />
              </div>
            )}
            <div>
              <Label htmlFor="season">Season (Year)</Label>
              <Input id="season" name="season" defaultValue={child.season || ""} placeholder="e.g., 2024" maxLength={4} />
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
            {currentCompany?.slug === 'timber-lake-west' && (
              <div>
                <Label>Session</Label>
                <Select value={session} onValueChange={setSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Not Specified</SelectItem>
                    <SelectItem value="First Session">First Session</SelectItem>
                    <SelectItem value="Second Session">Second Session</SelectItem>
                    <SelectItem value="First Session, Second Session">Both Sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
                if (e.target.value && e.target.value !== child?.rfid) {
                  setRfidJustScanned(true);
                  setTimeout(() => setRfidJustScanned(false), 2000);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // Move focus to next field after scan
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
              Scan the camper's ISO 14443 Type A wristband for quick check-in across the portal
            </p>
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