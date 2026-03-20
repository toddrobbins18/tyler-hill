import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { usePermissions } from "@/hooks/usePermissions";
import { sortDivisionsGirlsFirst } from "@/lib/divisionUtils";
import { Plus, Trash2, Users, ClipboardList, BarChart3, Clock, History, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { startOfWeek, format } from "date-fns";

const PERIODS = [
  { id: "period-1", label: "Period 1", time: "10:00 – 11:00 AM" },
  { id: "period-2", label: "Period 2", time: "11:00 AM – 12:00 PM" },
  { id: "period-3", label: "Period 3", time: "2:00 – 3:00 PM" },
  { id: "period-4", label: "Period 4", time: "3:00 – 4:00 PM" },
  { id: "period-5", label: "Period 5", time: "4:00 – 5:00 PM" },
  { id: "period-6", label: "Period 6", time: "5:00 – 6:00 PM" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export default function ElectiveSignUp() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { getDivisionFilter, loading: permissionsLoading, userDivisions } = usePermissions();
  const { toast } = useToast();

  const [divisions, setDivisions] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [electives, setElectives] = useState<any[]>([]);
  const [signups, setSignups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [selectedPeriod, setSelectedPeriod] = useState("period-1");
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [selectedElectiveFilter, setSelectedElectiveFilter] = useState("all");
  const [analyticsDivision, setAnalyticsDivision] = useState("all");

  // History state
  const [historySearch, setHistorySearch] = useState("");
  const [historyDivision, setHistoryDivision] = useState("all");
  const [historyResults, setHistoryResults] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyChildId, setHistoryChildId] = useState<string | null>(null);
  const [allChildren, setAllChildren] = useState<any[]>([]);

  // Add elective dialog
  const [addElectiveOpen, setAddElectiveOpen] = useState(false);
  const [newElectiveName, setNewElectiveName] = useState("");

  useEffect(() => {
    if (currentCompany?.id && !permissionsLoading) {
      fetchData();
    }
  }, [currentCompany, currentSeason, weekStart, selectedDay, selectedPeriod, permissionsLoading, userDivisions]);

  const fetchData = async () => {
    setLoading(true);
    const companyId = currentCompany!.id;
    const divisionFilter = getDivisionFilter();

    let divisionsQuery = supabase.from("divisions").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order");
    if (divisionFilter !== null && divisionFilter.length > 0) {
      divisionsQuery = divisionsQuery.in("id", divisionFilter);
    }

    const [divisionsRes, electivesRes, signupsRes, allChildrenRes] = await Promise.all([
      divisionsQuery,
      supabase.from("electives").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
      supabase.from("elective_signups").select("*, children(name, division_id), electives(name)")
        .eq("company_id", companyId)
        .eq("week_start_date", weekStart)
        .eq("day_of_week", selectedDay)
        .eq("period", selectedPeriod),
      supabase.from("children").select("id, name, division_id")
        .eq("company_id", companyId)
        .eq("season", currentSeason)
        .order("name"),
    ]);

    if (divisionsRes.data) setDivisions(sortDivisionsGirlsFirst(divisionsRes.data));
    if (electivesRes.data) setElectives(electivesRes.data);
    if (signupsRes.data) setSignups(signupsRes.data);
    if (allChildrenRes.data) setAllChildren(allChildrenRes.data);
    setLoading(false);
  };

  const fetchChildrenForDivision = async (divisionId: string) => {
    const { data } = await supabase
      .from("children")
      .select("id, name, division_id")
      .eq("company_id", currentCompany!.id)
      .eq("division_id", divisionId)
      .eq("season", currentSeason)
      .order("name");
    setChildren(data || []);
  };

  const handleDivisionSelect = (divisionId: string) => {
    setSelectedDivision(divisionId);
    fetchChildrenForDivision(divisionId);
  };

  const handleAssignElective = async (childId: string, electiveId: string | null) => {
    const companyId = currentCompany!.id;

    // Remove existing signup for this child/week/day/period
    await supabase
      .from("elective_signups")
      .delete()
      .eq("company_id", companyId)
      .eq("child_id", childId)
      .eq("week_start_date", weekStart)
      .eq("day_of_week", selectedDay)
      .eq("period", selectedPeriod);

    if (electiveId) {
      const { error } = await supabase.from("elective_signups").insert({
        company_id: companyId,
        child_id: childId,
        elective_id: electiveId,
        week_start_date: weekStart,
        day_of_week: selectedDay,
        period: selectedPeriod,
        season: currentSeason,
      });
      if (error) {
        toast({ title: "Error assigning elective", variant: "destructive" });
        return;
      }
    }

    // Refresh signups
    const { data } = await supabase
      .from("elective_signups")
      .select("*, children(name, division_id), electives(name)")
      .eq("company_id", companyId)
      .eq("week_start_date", weekStart)
      .eq("day_of_week", selectedDay)
      .eq("period", selectedPeriod);
    if (data) setSignups(data);
  };

  const handleAddElective = async () => {
    if (!newElectiveName.trim()) return;
    const { error } = await supabase.from("electives").insert({
      company_id: currentCompany!.id,
      name: newElectiveName.trim(),
    });
    if (error) {
      toast({ title: error.message.includes("duplicate") ? "Elective already exists" : "Error adding elective", variant: "destructive" });
      return;
    }
    toast({ title: "Elective added" });
    setNewElectiveName("");
    setAddElectiveOpen(false);
    fetchData();
  };

  const handleDeleteElective = async (id: string) => {
    const { error } = await supabase.from("electives").update({ is_active: false }).eq("id", id);
    if (error) {
      toast({ title: "Error removing elective", variant: "destructive" });
      return;
    }
    toast({ title: "Elective removed" });
    fetchData();
  };

  const getChildSignup = (childId: string) => signups.find((s) => s.child_id === childId);

  const divisionCamperCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // We don't have full children list per division, so we'll show from signups
    return counts;
  }, []);

  const periodLabel = PERIODS.find((p) => p.id === selectedPeriod);

  // Rosters: group signups by elective
  const rostersByElective = useMemo(() => {
    const grouped: Record<string, { name: string; campers: any[] }> = {};
    signups.forEach((s) => {
      const eName = (s.electives as any)?.name || "Unknown";
      const eId = s.elective_id;
      if (!grouped[eId]) grouped[eId] = { name: eName, campers: [] };
      grouped[eId].campers.push(s);
    });
    return Object.entries(grouped).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [signups]);

  // Analytics: elective popularity
  const analyticsData = useMemo(() => {
    let filtered = signups;
    if (analyticsDivision !== "all") {
      filtered = signups.filter((s) => (s.children as any)?.division_id === analyticsDivision);
    }
    const counts: Record<string, number> = {};
    filtered.forEach((s) => {
      const name = (s.electives as any)?.name || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [signups, analyticsDivision]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-1">Elective Sign-Up</h1>
          <p className="text-muted-foreground">Manage camper elective assignments by period</p>
        </div>
        <Dialog open={addElectiveOpen} onOpenChange={setAddElectiveOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Elective</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Elective</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Elective Name</Label>
                <Input
                  value={newElectiveName}
                  onChange={(e) => setNewElectiveName(e.target.value)}
                  placeholder="e.g., Basketball, Arts & Crafts"
                  onKeyDown={(e) => e.key === "Enter" && handleAddElective()}
                />
              </div>
              <Button onClick={handleAddElective} className="w-full">Add Elective</Button>

              {electives.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-muted-foreground text-xs">Current Electives</Label>
                  <div className="flex flex-wrap gap-2">
                    {electives.map((e) => (
                      <Badge key={e.id} variant="secondary" className="flex items-center gap-1 pr-1">
                        {e.name}
                        <button onClick={() => handleDeleteElective(e.id)} className="ml-1 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Week Starting</Label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label} — {p.time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {periodLabel && (
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {selectedDay} — {periodLabel.label} ({periodLabel.time})
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="signup">
        <TabsList>
          <TabsTrigger value="signup" className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" />Sign-Up
          </TabsTrigger>
          <TabsTrigger value="rosters" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />Rosters
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />Analytics
          </TabsTrigger>
        </TabsList>

        {/* SIGN-UP TAB */}
        <TabsContent value="signup">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* Division List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Divisions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {divisions.map((div) => (
                  <button
                    key={div.id}
                    onClick={() => handleDivisionSelect(div.id)}
                    className={`w-full flex justify-between items-center px-4 py-3 text-sm transition-colors border-b last:border-b-0 ${
                      selectedDivision === div.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span>{div.name}</span>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <Users className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Camper Assignment */}
            <Card>
              <CardContent className="pt-6">
                {!selectedDivision ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Users className="h-10 w-10 mb-3 opacity-40" />
                    <p>Select a division to see campers</p>
                  </div>
                ) : children.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No active campers in this division</p>
                ) : (
                  <div className="space-y-2">
                    {children.map((child) => {
                      const signup = getChildSignup(child.id);
                      return (
                        <div key={child.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                          <span className="font-medium text-sm">{child.name}</span>
                          <Select
                            value={signup?.elective_id || "none"}
                            onValueChange={(val) => handleAssignElective(child.id, val === "none" ? null : val)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Select elective" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {electives.map((e) => (
                                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ROSTERS TAB */}
        <TabsContent value="rosters">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <CardTitle>Rosters</CardTitle>
                <Select value={selectedElectiveFilter} onValueChange={setSelectedElectiveFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select elective" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Electives</SelectItem>
                    {electives.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {rostersByElective.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No signups for this period yet</p>
              ) : (
                <div className="space-y-6">
                  {rostersByElective
                    .filter(([id]) => selectedElectiveFilter === "all" || id === selectedElectiveFilter)
                    .map(([id, data]) => (
                      <div key={id}>
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="font-semibold">{data.name}</h3>
                          <Badge variant="secondary">{data.campers.length}</Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {data.campers.map((c: any) => (
                            <div key={c.id} className="p-2.5 rounded-md border bg-card text-sm">
                              {(c.children as any)?.name || "Unknown"}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <CardTitle>Elective Popularity</CardTitle>
                <Select value={analyticsDivision} onValueChange={setAnalyticsDivision}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {analyticsData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No signup data to display</p>
              ) : (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={120} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
