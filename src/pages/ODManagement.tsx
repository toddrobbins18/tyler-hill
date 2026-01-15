import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, AlertTriangle, Search, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Staff {
  id: string;
  name: string;
  department: string | null;
  role: string;
}

interface Bunk {
  id: string;
  bunk_number: number;
  bunk_name: string | null;
  division_id: string | null;
}

interface BunkStaff {
  id: string;
  bunk_id: string;
  staff_id: string;
  is_primary: boolean;
  staff?: Staff;
  bunk?: Bunk;
}

interface DayOff {
  id: string;
  staff_id: string;
  date: string;
  is_day_off: boolean;
  is_night_off: boolean;
  is_sleeping_out: boolean;
  checked_out: boolean;
  checked_in: boolean;
  notes: string | null;
  staff?: Staff;
}

export default function ODManagement() {
  const { currentCompany } = useCompany();
  const { selectedSeason: currentSeason } = useSeason();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("od");
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [bunks, setBunks] = useState<Bunk[]>([]);
  const [bunkStaff, setBunkStaff] = useState<BunkStaff[]>([]);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [uncoveredBunks, setUncoveredBunks] = useState<Bunk[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [selectedStaffForSwap, setSelectedStaffForSwap] = useState<string | null>(null);
  const [newSwapDate, setNewSwapDate] = useState<Date | undefined>(undefined);

  // Check if this is Tyler Hill Camp
  const isTylerHill = currentCompany?.slug === 'tyler-hill-camp';

  useEffect(() => {
    if (currentCompany?.id) {
      fetchData();
    }
  }, [currentCompany?.id, currentSeason, selectedDate]);

  useEffect(() => {
    // Calculate uncovered bunks when days off change
    checkUncoveredBunks();
  }, [daysOff, bunkStaff, bunks]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Fetch staff, bunks, bunk_staff, and days_off in parallel
      const [staffRes, bunksRes, bunkStaffRes, daysOffRes] = await Promise.all([
        supabase
          .from("staff")
          .select("id, name, department, role")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .order("name"),
        supabase
          .from("bunks")
          .select("id, bunk_number, bunk_name, division_id")
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .eq("is_active", true)
          .order("bunk_number"),
        supabase
          .from("bunk_staff")
          .select(`
            id, bunk_id, staff_id, is_primary,
            staff:staff_id(id, name, department, role),
            bunk:bunk_id(id, bunk_number, bunk_name, division_id)
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason),
        supabase
          .from("staff_days_off")
          .select(`
            id, staff_id, date, is_day_off, is_night_off, is_sleeping_out, 
            checked_out, checked_in, notes,
            staff:staff_id(id, name, department, role)
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", currentSeason)
          .eq("date", dateStr)
      ]);

      if (staffRes.data) setStaff(staffRes.data);
      if (bunksRes.data) setBunks(bunksRes.data);
      if (bunkStaffRes.data) setBunkStaff(bunkStaffRes.data as unknown as BunkStaff[]);
      if (daysOffRes.data) setDaysOff(daysOffRes.data as unknown as DayOff[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkUncoveredBunks = () => {
    // Find bunks where all assigned staff are off
    const staffOffIds = daysOff
      .filter(d => d.is_day_off || d.is_night_off)
      .map(d => d.staff_id);

    const uncovered = bunks.filter(bunk => {
      const assignedStaff = bunkStaff.filter(bs => bs.bunk_id === bunk.id);
      if (assignedStaff.length === 0) return true; // No staff assigned
      return assignedStaff.every(bs => staffOffIds.includes(bs.staff_id));
    });

    setUncoveredBunks(uncovered);
  };

  const getStaffWithBunk = () => {
    return bunkStaff.map(bs => {
      const staffMember = staff.find(s => s.id === bs.staff_id);
      const bunk = bunks.find(b => b.id === bs.bunk_id);
      const dayOff = daysOff.find(d => d.staff_id === bs.staff_id);
      
      return {
        ...bs,
        staff: staffMember,
        bunk,
        dayOff
      };
    }).filter(item => item.staff && item.bunk)
      .sort((a, b) => (a.bunk?.bunk_number || 0) - (b.bunk?.bunk_number || 0));
  };

  const handleToggleDayOff = async (staffId: string, field: 'is_day_off' | 'is_night_off' | 'is_sleeping_out') => {
    if (!currentCompany?.id) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const existing = daysOff.find(d => d.staff_id === staffId);

    try {
      if (existing) {
        const newValue = !existing[field];
        const updates: Partial<DayOff> = { [field]: newValue };
        
        // Auto-calculate night off when day off changes
        if (field === 'is_day_off') {
          updates.is_night_off = newValue;
        }

        const { error } = await supabase
          .from("staff_days_off")
          .update(updates)
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const newRecord = {
          company_id: currentCompany.id,
          staff_id: staffId,
          date: dateStr,
          season: currentSeason,
          is_day_off: field === 'is_day_off',
          is_night_off: field === 'is_day_off' || field === 'is_night_off',
          is_sleeping_out: field === 'is_sleeping_out'
        };

        const { error } = await supabase
          .from("staff_days_off")
          .insert(newRecord);

        if (error) throw error;
      }

      await fetchData();
      toast({ title: "Updated successfully" });
    } catch (error) {
      console.error("Error updating day off:", error);
      toast({ title: "Error updating", variant: "destructive" });
    }
  };

  const handleCheckInOut = async (staffId: string, type: 'out' | 'in') => {
    if (!currentCompany?.id) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const existing = daysOff.find(d => d.staff_id === staffId);

    if (!existing) {
      toast({ title: "Please set day off first", variant: "destructive" });
      return;
    }

    // Check if signing out on wrong day
    if (type === 'out' && !existing.is_day_off) {
      toast({ 
        title: "Warning: Signing out on wrong day", 
        description: "This staff member is not scheduled off today.",
        variant: "destructive" 
      });
      return;
    }

    try {
      const updates = type === 'out' 
        ? { checked_out: true, checked_out_at: new Date().toISOString() }
        : { checked_in: true, checked_in_at: new Date().toISOString() };

      const { error } = await supabase
        .from("staff_days_off")
        .update(updates)
        .eq("id", existing.id);

      if (error) throw error;
      
      await fetchData();
      toast({ title: `Checked ${type} successfully` });
    } catch (error) {
      console.error("Error checking in/out:", error);
      toast({ title: "Error updating", variant: "destructive" });
    }
  };

  const handleSwapDayOff = async () => {
    if (!selectedStaffForSwap || !newSwapDate || !currentCompany?.id) return;

    const oldDateStr = format(selectedDate, "yyyy-MM-dd");
    const newDateStr = format(newSwapDate, "yyyy-MM-dd");

    try {
      // Remove old day off
      await supabase
        .from("staff_days_off")
        .delete()
        .eq("staff_id", selectedStaffForSwap)
        .eq("date", oldDateStr)
        .eq("company_id", currentCompany.id);

      // Create new day off
      await supabase
        .from("staff_days_off")
        .upsert({
          company_id: currentCompany.id,
          staff_id: selectedStaffForSwap,
          date: newDateStr,
          season: currentSeason,
          is_day_off: true,
          is_night_off: true
        });

      setShowSwapDialog(false);
      setSelectedStaffForSwap(null);
      setNewSwapDate(undefined);
      await fetchData();
      toast({ title: "Day off switched successfully" });
    } catch (error) {
      console.error("Error swapping day off:", error);
      toast({ title: "Error switching day off", variant: "destructive" });
    }
  };

  const filteredStaffWithBunk = getStaffWithBunk().filter(item => 
    item.staff?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.bunk?.bunk_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const navigateDate = (days: number) => {
    setSelectedDate(addDays(selectedDate, days));
  };

  if (!isTylerHill) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">OD Management</h1>
          <p className="text-muted-foreground">This feature is only available for Tyler Hill Camp.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">OD Management</h1>
          <p className="text-muted-foreground">
            Manage staff days off and bunk coverage
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[200px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Uncovered Bunks Alert */}
      {uncoveredBunks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Uncovered Bunks</AlertTitle>
          <AlertDescription>
            The following bunks have no coverage for OD: {" "}
            {uncoveredBunks.map(b => b.bunk_name || `Bunk ${b.bunk_number}`).join(", ")}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="od">OD</TabsTrigger>
          <TabsTrigger value="off">Off</TabsTrigger>
        </TabsList>

        <TabsContent value="od" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>On Duty Staff</CardTitle>
                  <CardDescription>
                    Staff members on duty for {format(selectedDate, "MMMM d, yyyy")}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or bunk..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bunk</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Out</TableHead>
                      <TableHead className="text-center">Sleeping Out</TableHead>
                      <TableHead className="text-center">In</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffWithBunk
                      .filter(item => !item.dayOff?.is_day_off)
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.bunk?.bunk_name || item.bunk?.bunk_number}
                          </TableCell>
                          <TableCell>{item.staff?.name}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.dayOff?.checked_out || false}
                              onCheckedChange={() => handleCheckInOut(item.staff_id, 'out')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.dayOff?.is_sleeping_out || false}
                              onCheckedChange={() => handleToggleDayOff(item.staff_id, 'is_sleeping_out')}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.dayOff?.checked_in || false}
                              onCheckedChange={() => handleCheckInOut(item.staff_id, 'in')}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleDayOff(item.staff_id, 'is_day_off')}
                            >
                              Mark Off
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {filteredStaffWithBunk.filter(item => !item.dayOff?.is_day_off).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No staff on duty found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="off" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>Staff Off</CardTitle>
                  <CardDescription>
                    Staff members off for {format(selectedDate, "MMMM d, yyyy")}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or bunk..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bunk</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">In</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffWithBunk
                      .filter(item => item.dayOff?.is_day_off)
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.bunk?.bunk_name || item.bunk?.bunk_number}
                          </TableCell>
                          <TableCell>{item.staff?.name}</TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.dayOff?.checked_in || false}
                              onCheckedChange={() => handleCheckInOut(item.staff_id, 'in')}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {item.dayOff?.is_day_off && <Badge>Day Off</Badge>}
                              {item.dayOff?.is_night_off && <Badge variant="secondary">Night Off</Badge>}
                              {item.dayOff?.checked_out && <Badge variant="outline">Out</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStaffForSwap(item.staff_id);
                                  setShowSwapDialog(true);
                                }}
                              >
                                <ArrowLeftRight className="h-4 w-4 mr-1" />
                                Switch
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleDayOff(item.staff_id, 'is_day_off')}
                              >
                                Remove
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    {filteredStaffWithBunk.filter(item => item.dayOff?.is_day_off).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No staff off today
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Swap Day Off Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Day Off</DialogTitle>
            <DialogDescription>
              Select a new date for this staff member's day off. The current day off will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newSwapDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newSwapDate ? format(newSwapDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={newSwapDate}
                    onSelect={setNewSwapDate}
                    initialFocus
                    disabled={(date) => date <= selectedDate}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSwapDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSwapDayOff} disabled={!newSwapDate}>
              Switch Day Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
