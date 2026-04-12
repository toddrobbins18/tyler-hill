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
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";

const TSHIRT_SIZES = [
  "Youth S", "Youth M", "Youth L", "Youth XL",
  "Adult XS", "Adult S", "Adult M", "Adult L", "Adult XL", "Adult 2XL", "Adult 3XL"
];

export default function AddChildDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [tshirtSize, setTshirtSize] = useState<string>("");
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();

  const form = useForm<z.infer<typeof childSchema>>({
    resolver: zodResolver(childSchema),
    defaultValues: {
      name: "",
      person_id: "",
      age: null,
      gender: null,
      category: null,
      grade: null,
      group_name: null,
      season: currentSeason,
      division_id: null,
      leader_id: null,
      guardian_email: null,
      guardian_phone: null,
      emergency_contact: null,
      allergies: null,
      medical_notes: null,
    },
  });

  useEffect(() => {
    if (open) {
      fetchStaff();
      fetchDivisions();
    }
  }, [open]);

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
      .eq("company_id", currentCompany.id)
      .eq("is_active", true);
    setDivisions(sortDivisionsAlternatingGender(data || []));
  };

  const onSubmit = async (values: z.infer<typeof childSchema>) => {
    try {
      const insertData: any = {
        name: values.name,
        person_id: values.person_id,
        age: values.age ?? null,
        gender: values.gender ?? null,
        category: values.category ?? null,
        grade: values.grade ?? null,
        group_name: values.group_name ?? null,
        season: values.season ?? null,
        session: currentCompany?.slug === 'timber-lake-west' ? values.season : null,
        division_id: values.division_id ?? null,
        leader_id: values.leader_id ?? null,
        guardian_email: values.guardian_email ?? null,
        guardian_phone: values.guardian_phone ?? null,
        emergency_contact: values.emergency_contact ?? null,
        allergies: values.allergies ?? null,
        medical_notes: values.medical_notes ?? null,
        company_id: currentCompany?.id,
        tshirt_size: tshirtSize || null,
      };

      const { error } = await supabase.from("children").insert([insertData]);

      if (error) {
        toast.error("Failed to add child");
        console.error(error);
      } else {
        toast.success("Child added successfully");
        setOpen(false);
        form.reset();
        setTshirtSize("");
        onSuccess?.();
      }
    } catch (error) {
      toast.error("Failed to add child");
      console.error(error);
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
        <p className="text-sm text-muted-foreground mb-4">
          Fields marked with <span className="text-destructive">*</span> are required
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="First and Last Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="person_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., TLW001" {...field} />
                    </FormControl>
                    <FormDescription>Unique identifier for this camper</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value ?? ""} 
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="division_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Division</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select division" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {divisions.map((division) => (
                          <SelectItem key={division.id} value={division.id}>
                            {division.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="group_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="season"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Season (Year)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2024" maxLength={4} {...field} value={field.value || currentSeason} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {currentCompany?.slug === 'timber-lake-west' && (
                <FormField
                  control={form.control}
                  name="season"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select session" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="First Session">First Session</SelectItem>
                          <SelectItem value="Second Session">Second Session</SelectItem>
                          <SelectItem value="First Session, Second Session">Both Sessions</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="leader_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Assigned Leader</FormLabel>
                    <div className="grid grid-cols-2 gap-4">
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a leader" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {staff.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name} - {member.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={tshirtSize || "none"} onValueChange={(val) => setTshirtSize(val === "none" ? "" : val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="T-Shirt Size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not Specified</SelectItem>
                          {TSHIRT_SIZES.map(size => (
                            <SelectItem key={size} value={size}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guardian_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guardian Email</FormLabel>
                      <FormControl>
                      <Input type="email" {...field} value={field.value ?? ""} />
                      </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guardian_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guardian Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="emergency_contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rfid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RFID Bracelet</FormLabel>
                  <FormControl>
                    <Input placeholder="Scan or enter RFID" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>
                    Scan the camper's RFID bracelet for quick medication check-in
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allergies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allergies</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medical_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding..." : "Add Child"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
