import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { childSchema } from "@/lib/validationSchemas";
import { z } from "zod";
import { useCompany } from "@/contexts/CompanyContext";
import { sortDivisionsGirlsFirst } from "@/lib/divisionUtils";

interface EditChildDialogProps {
  childId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditChildDialog({ childId, open, onOpenChange, onSuccess }: EditChildDialogProps) {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [child, setChild] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [leaderId, setLeaderId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [gender, setGender] = useState("");
  const [session, setSession] = useState("");
  const [birthdayPartyType, setBirthdayPartyType] = useState("");
  const [birthdayCakeMeal, setBirthdayCakeMeal] = useState("");
  const [birthdayCakeType, setBirthdayCakeType] = useState("");
  const [birthdayFrostingColors, setBirthdayFrostingColors] = useState<string[]>([]);
  const [birthdayToppings, setBirthdayToppings] = useState<string[]>([]);
  const [birthdayCakeAllergies, setBirthdayCakeAllergies] = useState<string[]>([]);

  useEffect(() => {
    if (open && childId) {
      fetchChild();
      fetchStaff();
      fetchDivisions();
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
      setSession(data.session || "");
      setLeaderId(data.leader_id || "");
      setDivisionId(data.division_id || "");
        setBirthdayPartyType(data.birthday_party_type || "");
        setBirthdayCakeMeal(data.birthday_cake_meal || "");
        setBirthdayCakeType(data.birthday_cake_type || "");
      setBirthdayFrostingColors(data.birthday_frosting_colors || []);
      setBirthdayToppings(data.birthday_toppings || []);
      setBirthdayCakeAllergies(data.birthday_cake_allergies || []);
    }
  };

  const fetchStaff = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .order("name");
    setStaff(data || []);
  };

  const fetchDivisions = async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .eq("company_id", currentCompany.id);
    setDivisions(sortDivisionsGirlsFirst(data || []));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        name: formData.get("name") as string,
        person_id: formData.get("person_id") as string,
        age: formData.get("age") ? parseInt(formData.get("age") as string) : null,
        date_of_birth: formData.get("date_of_birth") as string || null,
        gender: gender || null,
        category: formData.get("category") as string || null,
        grade: formData.get("grade") as string || null,
        group_name: formData.get("group_name") as string || null,
        season: formData.get("season") as string || null,
        session: session || null,
        division_id: divisionId || null,
        leader_id: leaderId || null,
        guardian_email: formData.get("guardian_email") as string || null,
        guardian_phone: formData.get("guardian_phone") as string || null,
        emergency_contact: formData.get("emergency_contact") as string || null,
        allergies: formData.get("allergies") as string || null,
        medical_notes: formData.get("medical_notes") as string || null,
        rfid: formData.get("rfid") as string || null,
      birthday_party_type: birthdayPartyType || null,
      birthday_cake_meal: birthdayCakeMeal || null,
      birthday_party_comments: formData.get("birthday_party_comments") as string || null,
      birthday_cake_type: birthdayCakeType || null,
        birthday_frosting_colors: birthdayFrostingColors.length > 0 ? birthdayFrostingColors : null,
        birthday_toppings: birthdayToppings.length > 0 ? birthdayToppings : null,
        birthday_cake_allergies: birthdayCakeAllergies.length > 0 ? birthdayCakeAllergies : null,
        birthday_cake_message: formData.get("birthday_cake_message") as string || null,
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
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="grade">Grade</Label>
              <Input id="grade" name="grade" defaultValue={child.grade || ""} />
            </div>
            <div>
              <Label htmlFor="group_name">Group</Label>
              <Input id="group_name" name="group_name" defaultValue={child.group_name || ""} />
            </div>
            <div>
              <Label htmlFor="season">Season (Year)</Label>
              <Input id="season" name="season" defaultValue={child.season || ""} placeholder="e.g., 2024" maxLength={4} />
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
                    <SelectItem value="session_1">Session 1</SelectItem>
                    <SelectItem value="session_2">Session 2</SelectItem>
                    <SelectItem value="both">Both Sessions</SelectItem>
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
          <div>
            <Label htmlFor="rfid">RFID Bracelet</Label>
            <Input id="rfid" name="rfid" defaultValue={child.rfid || ""} placeholder="Scan or enter RFID" />
            <p className="text-xs text-muted-foreground mt-1">
              Scan the camper's RFID bracelet for quick medication check-in
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
          
          <div className="border-t pt-4 space-y-6">
            <h3 className="font-semibold text-lg">Birthday Party Preferences</h3>
            
            <div className="space-y-3">
              <Label>Birthday Celebration Choice</Label>
              <RadioGroup value={birthdayPartyType} onValueChange={setBirthdayPartyType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="" id="party-none" />
                  <Label htmlFor="party-none" className="font-normal cursor-pointer">None</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pizza_soda" id="party-pizza" />
                  <Label htmlFor="party-pizza" className="font-normal cursor-pointer">Pizza & Soda Party at Rec Hall</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ice_cream" id="party-icecream" />
                  <Label htmlFor="party-icecream" className="font-normal cursor-pointer">Ice Cream Party in the Canteen</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cookies_movie" id="party-movie" />
                  <Label htmlFor="party-movie" className="font-normal cursor-pointer">Reggies Cookies and Bunk Movie</Label>
                </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="campfire_smores" id="party-campfire" />
                    <Label htmlFor="party-campfire" className="font-normal cursor-pointer">Campfire and S'mores</Label>
                  </div>
                </RadioGroup>
            </div>

            <div>
              <Label htmlFor="birthday_party_comments">Additional Comments</Label>
              <Textarea 
                id="birthday_party_comments" 
                name="birthday_party_comments" 
                defaultValue={child.birthday_party_comments || ""}
                placeholder="Any special requests (e.g., campfire location, timing, number of people in bunk)"
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>When do you want the cake served?</Label>
              <RadioGroup value={birthdayCakeMeal} onValueChange={setBirthdayCakeMeal}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="" id="cake-none" />
                  <Label htmlFor="cake-none" className="font-normal cursor-pointer">None</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="lunch" id="cake-lunch" />
                  <Label htmlFor="cake-lunch" className="font-normal cursor-pointer">Lunch</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dinner" id="cake-dinner" />
                  <Label htmlFor="cake-dinner" className="font-normal cursor-pointer">Dinner</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-semibold">Cake Customization</h4>
              
              <div className="space-y-3">
                <Label>Cake Type</Label>
                <RadioGroup value={birthdayCakeType} onValueChange={setBirthdayCakeType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="rice_krispy" id="cake-krispy" />
                    <Label htmlFor="cake-krispy" className="font-normal cursor-pointer">Rice Krispy Sheet Cake</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="vanilla" id="cake-vanilla" />
                    <Label htmlFor="cake-vanilla" className="font-normal cursor-pointer">Vanilla Frosted Cake</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="chocolate" id="cake-chocolate" />
                    <Label htmlFor="cake-chocolate" className="font-normal cursor-pointer">Chocolate Frosted Cake</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Frosting Color (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink', 'No Color'].map((color) => (
                    <div key={color} className="flex items-center space-x-2">
                      <Checkbox
                        id={`frosting-${color.toLowerCase().replace(' ', '-')}`}
                        checked={birthdayFrostingColors.includes(color.toLowerCase().replace(' ', '_'))}
                        onCheckedChange={(checked) => {
                          const value = color.toLowerCase().replace(' ', '_');
                          if (checked) {
                            setBirthdayFrostingColors([...birthdayFrostingColors, value]);
                          } else {
                            setBirthdayFrostingColors(birthdayFrostingColors.filter(c => c !== value));
                          }
                        }}
                      />
                      <Label htmlFor={`frosting-${color.toLowerCase().replace(' ', '-')}`} className="font-normal cursor-pointer">
                        {color}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Toppings (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {['Rainbow Sprinkles', 'Chocolate Sprinkles', 'Crushed Oreos', 'Sour Patch', 'Marshmallows', 'Graham Crackers', 'Pretzels', "M&M's", 'Strawberries', 'Blueberries', 'Cookies', 'Cherries', 'Chocolate Syrup', 'Caramel Syrup', 'No Toppings'].map((topping) => (
                    <div key={topping} className="flex items-center space-x-2">
                      <Checkbox
                        id={`topping-${topping.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                        checked={birthdayToppings.includes(topping.toLowerCase().replace(/[^a-z0-9]/g, '_'))}
                        onCheckedChange={(checked) => {
                          const value = topping.toLowerCase().replace(/[^a-z0-9]/g, '_');
                          if (checked) {
                            setBirthdayToppings([...birthdayToppings, value]);
                          } else {
                            setBirthdayToppings(birthdayToppings.filter(t => t !== value));
                          }
                        }}
                      />
                      <Label htmlFor={`topping-${topping.toLowerCase().replace(/[^a-z0-9]/g, '-')}`} className="font-normal cursor-pointer">
                        {topping}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Any Allergies? (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {['Gluten', 'Dairy', 'Sesame', 'Egg', 'Soy', 'Vegan'].map((allergy) => (
                    <div key={allergy} className="flex items-center space-x-2">
                      <Checkbox
                        id={`allergy-${allergy.toLowerCase()}`}
                        checked={birthdayCakeAllergies.includes(allergy.toLowerCase())}
                        onCheckedChange={(checked) => {
                          const value = allergy.toLowerCase();
                          if (checked) {
                            setBirthdayCakeAllergies([...birthdayCakeAllergies, value]);
                          } else {
                            setBirthdayCakeAllergies(birthdayCakeAllergies.filter(a => a !== value));
                          }
                        }}
                      />
                      <Label htmlFor={`allergy-${allergy.toLowerCase()}`} className="font-normal cursor-pointer">
                        {allergy}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="birthday_cake_message">What do you want written on the cake?</Label>
                <Textarea 
                  id="birthday_cake_message" 
                  name="birthday_cake_message" 
                  defaultValue={child.birthday_cake_message || ""}
                  placeholder="Enter custom message for the cake"
                  rows={3}
                />
              </div>
            </div>
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