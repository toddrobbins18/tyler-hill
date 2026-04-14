import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, UserPlus, X } from "lucide-react";
import BunkStaffCSVUploader from "./BunkStaffCSVUploader";

interface Staff {
  id: string;
  name: string;
  department: string | null;
}

interface Division {
  id: string;
  name: string;
}

interface Bunk {
  id: string;
  bunk_number: number;
  bunk_name: string | null;
  division_id: string | null;
  is_active: boolean;
}

interface BunkStaff {
  id: string;
  bunk_id: string;
  staff_id: string;
  is_primary: boolean;
  staff?: Staff;
}

interface BunkManagementProps {
  onClose: () => void;
}

export default function BunkManagement({ onClose }: BunkManagementProps) {
  const { currentCompany } = useCompany();
  const { selectedSeason: currentSeason } = useSeason();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [bunks, setBunks] = useState<Bunk[]>([]);
  const [bunkStaff, setBunkStaff] = useState<BunkStaff[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  // New bunk form
  const [newBunkNumber, setNewBunkNumber] = useState<number>(1);
  const [newBunkName, setNewBunkName] = useState("");
  const [newBunkDivision, setNewBunkDivision] = useState<string>("none");

  // Staff assignment
  const [selectedBunkForStaff, setSelectedBunkForStaff] = useState<string | null>(null);
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState<string>("");

  useEffect(() => {
    if (currentCompany?.id) {
      fetchData();
    }
  }, [currentCompany?.id, currentSeason]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      const [bunksRes, bunkStaffRes, staffRes, divisionsRes] = await Promise.all([
        supabase
          .from("bunks")
          .select("*")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .order("bunk_number"),
        supabase
          .from("bunk_staff")
          .select(`
            id, bunk_id, staff_id, is_primary,
            staff:staff_id(id, name, department)
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason),
        supabase
          .from("staff")
          .select("id, name, department")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .order("name"),
        supabase
          .from("divisions")
          .select("id, name")
          .eq("company_id", currentCompany.id)
          .eq("is_active", true)
          .order("sort_order")
      ]);

      if (bunksRes.data) {
        setBunks(bunksRes.data);
        // Set default new bunk number
        const maxBunk = Math.max(0, ...bunksRes.data.map(b => b.bunk_number));
        setNewBunkNumber(maxBunk + 1);
      }
      if (bunkStaffRes.data) setBunkStaff(bunkStaffRes.data as unknown as BunkStaff[]);
      if (staffRes.data) setStaff(staffRes.data);
      if (divisionsRes.data) setDivisions(sortDivisionsAlternatingGender(divisionsRes.data));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBunk = async () => {
    if (!currentCompany?.id) return;

    try {
      const { error } = await supabase
        .from("bunks")
        .insert({
          company_id: currentCompany.id,
          bunk_number: newBunkNumber,
          bunk_name: newBunkName || null,
          division_id: newBunkDivision === "none" ? null : newBunkDivision,
          season: currentSeason,
          is_active: true
        });

      if (error) throw error;

      toast({ title: "Bunk added successfully" });
      setNewBunkName("");
      setNewBunkDivision("none");
      await fetchData();
    } catch (error) {
      console.error("Error adding bunk:", error);
      toast({ title: "Error adding bunk", variant: "destructive" });
    }
  };

  const handleDeleteBunk = async (bunkId: string) => {
    if (!confirm("Are you sure you want to delete this bunk?")) return;

    try {
      const { error } = await supabase
        .from("bunks")
        .delete()
        .eq("id", bunkId);

      if (error) throw error;

      toast({ title: "Bunk deleted successfully" });
      await fetchData();
    } catch (error) {
      console.error("Error deleting bunk:", error);
      toast({ title: "Error deleting bunk", variant: "destructive" });
    }
  };

  const handleAddStaffToBunk = async () => {
    if (!selectedBunkForStaff || !selectedStaffToAdd || !currentCompany?.id) return;

    try {
      const { error } = await supabase
        .from("bunk_staff")
        .insert({
          company_id: currentCompany.id,
          bunk_id: selectedBunkForStaff,
          staff_id: selectedStaffToAdd,
          season: currentSeason,
          is_primary: false
        });

      if (error) throw error;

      toast({ title: "Staff assigned to bunk" });
      setSelectedStaffToAdd("");
      await fetchData();
    } catch (error) {
      console.error("Error assigning staff:", error);
      toast({ title: "Error assigning staff", variant: "destructive" });
    }
  };

  const handleRemoveStaffFromBunk = async (bunkStaffId: string) => {
    try {
      const { error } = await supabase
        .from("bunk_staff")
        .delete()
        .eq("id", bunkStaffId);

      if (error) throw error;

      toast({ title: "Staff removed from bunk" });
      await fetchData();
    } catch (error) {
      console.error("Error removing staff:", error);
      toast({ title: "Error removing staff", variant: "destructive" });
    }
  };

  const getAssignedStaffIds = () => {
    return bunkStaff.map(bs => bs.staff_id);
  };

  const getAvailableStaff = () => {
    const assignedIds = getAssignedStaffIds();
    return staff.filter(s => !assignedIds.includes(s.id));
  };

  const getBunkStaff = (bunkId: string) => {
    return bunkStaff.filter(bs => bs.bunk_id === bunkId);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <Tabs defaultValue="manage" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="manage">Manage Bunks</TabsTrigger>
        <TabsTrigger value="upload">CSV Upload</TabsTrigger>
      </TabsList>

      <TabsContent value="manage" className="space-y-6">
      {/* Add New Bunk */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Add New Bunk</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Bunk Number</Label>
            <Input
              type="number"
              value={newBunkNumber}
              onChange={(e) => setNewBunkNumber(parseInt(e.target.value) || 1)}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>Bunk Name (optional)</Label>
            <Input
              value={newBunkName}
              onChange={(e) => setNewBunkName(e.target.value)}
              placeholder="e.g., Bunk A, Senior Boys 1"
            />
          </div>
          <div className="space-y-2">
            <Label>Division (optional)</Label>
            <Select value={newBunkDivision} onValueChange={setNewBunkDivision}>
              <SelectTrigger>
                <SelectValue placeholder="Select division..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {divisions.map(div => (
                  <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleAddBunk}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bunk
            </Button>
          </div>
        </div>
      </div>

      {/* Bunks List */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Bunk #</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Division</TableHead>
            <TableHead>Assigned Staff</TableHead>
            <TableHead className="w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bunks.map((bunk) => {
            const bunkStaffList = getBunkStaff(bunk.id);
            const division = divisions.find(d => d.id === bunk.division_id);

            return (
              <TableRow key={bunk.id}>
                <TableCell className="font-medium">{bunk.bunk_number}</TableCell>
                <TableCell>{bunk.bunk_name || "-"}</TableCell>
                <TableCell>
                  {division ? (
                    <Badge variant="secondary">{division.name}</Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2 items-center">
                    {bunkStaffList.map(bs => (
                      <Badge key={bs.id} variant="outline" className="flex items-center gap-1">
                        {bs.staff?.name}
                        <button
                          onClick={() => handleRemoveStaffFromBunk(bs.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    
                    {selectedBunkForStaff === bunk.id ? (
                      <div className="flex items-center gap-2">
                        <Select value={selectedStaffToAdd} onValueChange={setSelectedStaffToAdd}>
                          <SelectTrigger className="w-40 h-8">
                            <SelectValue placeholder="Select staff..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableStaff().map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          size="sm" 
                          onClick={handleAddStaffToBunk}
                          disabled={!selectedStaffToAdd}
                        >
                          Add
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            setSelectedBunkForStaff(null);
                            setSelectedStaffToAdd("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedBunkForStaff(bunk.id)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBunk(bunk.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {bunks.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No bunks configured yet. Add your first bunk above.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose}>Done</Button>
      </div>
      </TabsContent>

      <TabsContent value="upload" className="space-y-6">
        <BunkStaffCSVUploader onUploadComplete={fetchData} />
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Done</Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
