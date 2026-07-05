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
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";
import { camperMatchesDivisionFilter } from "@/lib/divisionFilterUtils";
import { Plus, Trash2, Users, ClipboardList, BarChart3, Clock, History, Search, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { startOfWeek, format, parseISO, addDays } from "date-fns";
import {
  filterElectivesForPeriod,
  TIMBER_LAKE_ELECTIVE_PERIODS,
  getDefaultElectiveCalendarDate,
  electiveSlotFromCalendarDate,
  shiftElectiveCalendarDate,
  normalizeElectiveCalendarDate,
} from "@/lib/timberLakeElectiveSchedule";

const PERIODS = [...TIMBER_LAKE_ELECTIVE_PERIODS];

function divisionNameForId(divisionId: string | null | undefined, divisions: { id: string; name?: string | null }[]) {
  if (!divisionId) return null;
  return divisions.find((d) => d.id === divisionId)?.name ?? null;
}

function resolveSignupChildName(
  signup: { child_id: string; children?: { name?: string | null } | null },
  allChildren: { id: string; name?: string | null }[],
) {
  const embedded = signup.children?.name;
  if (embedded) return embedded;
  return allChildren.find((c) => c.id === signup.child_id)?.name || "Unknown";
}

function signupMatchesDivisionFilter(
  signup: { child_id: string; children?: { division_id?: string | null } | null },
  selectedDivisionId: string,
  divisions: { id: string; name?: string | null }[],
  allChildren: { id: string; division_id?: string | null }[],
) {
  const selectedName = divisionNameForId(selectedDivisionId, divisions);
  const child = allChildren.find((c) => c.id === signup.child_id);
  const camperDivId = signup.children?.division_id ?? child?.division_id;
  const camperDivName = divisionNameForId(camperDivId, divisions);
  return camperMatchesDivisionFilter(camperDivId, camperDivName, selectedDivisionId, selectedName);
}

export default function ElectiveSignUp() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { getDivisionFilter, loading: permissionsLoading, userDivisionsKey } = usePermissions();
  const { toast } = useToast();

  const [divisions, setDivisions] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [electives, setElectives] = useState<any[]>([]);
  const [signups, setSignups] = useState<any[]>([]);
  const [slotCountsByElective, setSlotCountsByElective] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const isTlc = currentCompany?.name.toLowerCase().includes("timber lake camp") ?? false;

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => getDefaultElectiveCalendarDate());
  const [weekStart, setWeekStart] = useState(() =>
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  );
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
  const [newElectiveCapacity, setNewElectiveCapacity] = useState<number | "">(10);
  const [editingCapacities, setEditingCapacities] = useState<Record<string, number | "">>({});

  useEffect(() => {
    const slot = electiveSlotFromCalendarDate(parseISO(selectedDate));
    setWeekStart(slot.weekStartDate);
    setSelectedDay(slot.dayOfWeek);
  }, [selectedDate]);

  useEffect(() => {
    if (currentCompany?.id && !permissionsLoading) {
      fetchData();
    }
  }, [currentCompany, currentSeason, weekStart, selectedDay, selectedPeriod, permissionsLoading, userDivisionsKey, isTlc, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    const companyId = currentCompany!.id;
    const divisionFilter = getDivisionFilter();

    let divisionsQuery = supabase.from("divisions").select("*").eq("company_id", companyId).eq("is_active", true).order("sort_order");
    if (divisionFilter !== null && divisionFilter.length > 0) {
      divisionsQuery = divisionsQuery.in("id", divisionFilter);
    }

    const [divisionsRes, electivesRes, signupsRes, allChildrenRes, slotCountsRes] = await Promise.all([
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
        .neq("status", "inactive")
        .order("name"),
      (supabase as any).rpc("get_elective_slot_counts", {
        p_company_id: companyId,
        p_week_start: weekStart,
        p_day_of_week: selectedDay,
        p_period: selectedPeriod,
      }),
    ]);

    if (divisionsRes.data) setDivisions(sortDivisionsAlternatingGender(divisionsRes.data));
    if (electivesRes.data) {
      let filteredElectives = electivesRes.data.filter(
        (e: { is_active?: boolean | null }) => e.is_active !== false,
      );
      if (currentCompany.name.toLowerCase().includes("timber lake camp")) {
        filteredElectives = filterElectivesForPeriod(filteredElectives, selectedPeriod);
      }
      setElectives(filteredElectives);
    }
    if (signupsRes.data) setSignups(signupsRes.data);
    if (allChildrenRes.data) setAllChildren(allChildrenRes.data);
    if (slotCountsRes.data) {
      const counts: Record<string, number> = {};
      (slotCountsRes.data as unknown as { elective_id: string; signup_count: number }[]).forEach((row) => {
        counts[row.elective_id] = Number(row.signup_count);
      });
      setSlotCountsByElective(counts);
    } else {
      setSlotCountsByElective({});
    }
    setLoading(false);
  };

  const filterChildrenForDivision = (divisionId: string, camperPool = allChildren) => {
    const selectedDivisionRecord = divisions.find((d) => d.id === divisionId);
    const filtered = camperPool.filter((child) =>
      camperMatchesDivisionFilter(
        child.division_id,
        divisionNameForId(child.division_id, divisions),
        divisionId,
        selectedDivisionRecord?.name,
      ),
    );
    setChildren(filtered);
  };

  useEffect(() => {
    if (selectedDivision) {
      filterChildrenForDivision(selectedDivision);
    }
  }, [allChildren, divisions, selectedDivision]);

  const handleDivisionSelect = (divisionId: string) => {
    setSelectedDivision(divisionId);
    filterChildrenForDivision(divisionId);
  };

  const handleAssignElective = async (childId: string, electiveId: string | null) => {
    const companyId = currentCompany!.id;

    // Validate capacity BEFORE deleting the current signup, otherwise a blocked
    // assignment would erase the camper's existing elective and leave nothing.
    if (electiveId) {
      const rawCap = electives.find((e) => e.id === electiveId)?.capacity;
      const capNum =
        rawCap != null && rawCap !== ""
          ? typeof rawCap === "number"
            ? rawCap
            : parseInt(String(rawCap), 10)
          : NaN;
      const count = signupCountByElective[electiveId] || 0;
      const already = getChildSignup(childId)?.elective_id === electiveId;
      if (!Number.isNaN(capNum) && count >= capNum && !already) {
        toast({ title: "This elective is at capacity.", variant: "destructive" });
        return;
      }
    }

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
        toast({
          title: error.message.includes("capacity") ? "This elective is at capacity." : "Error assigning elective",
          variant: "destructive",
        });
        // Re-sync so the UI reflects the true state (the delete above already ran).
        await fetchData();
        return;
      }
    }

    // Refresh signups
    const [signupsRefresh, slotCountsRefresh] = await Promise.all([
      supabase
        .from("elective_signups")
        .select("*, children(name, division_id), electives(name)")
        .eq("company_id", companyId)
        .eq("week_start_date", weekStart)
        .eq("day_of_week", selectedDay)
        .eq("period", selectedPeriod),
      (supabase as any).rpc("get_elective_slot_counts", {
        p_company_id: companyId,
        p_week_start: weekStart,
        p_day_of_week: selectedDay,
        p_period: selectedPeriod,
      }),
    ]);
    if (signupsRefresh.data) setSignups(signupsRefresh.data);
    if (slotCountsRefresh.data) {
      const counts: Record<string, number> = {};
      (slotCountsRefresh.data as unknown as { elective_id: string; signup_count: number }[]).forEach((row) => {
        counts[row.elective_id] = Number(row.signup_count);
      });
      setSlotCountsByElective(counts);
    }
  };

  const handleAddElective = async () => {
    if (!newElectiveName.trim()) return;
    const { error } = await supabase.from("electives").insert({
      company_id: currentCompany!.id,
      name: newElectiveName.trim(),
      capacity: newElectiveCapacity || null,
    } as any);
    if (error) {
      toast({ title: error.message.includes("duplicate") ? "Elective already exists" : "Error adding elective", variant: "destructive" });
      return;
    }
    toast({ title: "Elective added" });
    setNewElectiveName("");
    setNewElectiveCapacity(10);
    setAddElectiveOpen(false);
    fetchData();
  };

  const handleSaveCapacity = async (electiveId: string) => {
    const cap = editingCapacities[electiveId];
    const { error } = await supabase.from("electives").update({ capacity: cap === "" ? null : cap } as any).eq("id", electiveId);
    if (error) {
      toast({ title: "Error saving capacity", variant: "destructive" });
      return;
    }
    toast({ title: "Capacity updated" });
    fetchData();
  };

  // Count signups per elective for the current period/day/week (camp-wide)
  const signupCountByElective = useMemo(() => {
    if (Object.keys(slotCountsByElective).length > 0) {
      return slotCountsByElective;
    }
    const counts: Record<string, number> = {};
    signups.forEach((s) => {
      if (s.elective_id) {
        counts[s.elective_id] = (counts[s.elective_id] || 0) + 1;
      }
    });
    return counts;
  }, [signups, slotCountsByElective]);

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

  const fetchCamperHistory = async (childId: string) => {
    setHistoryLoading(true);
    setHistoryChildId(childId);
    const { data } = await supabase
      .from("elective_signups")
      .select("*, electives(name)")
      .eq("company_id", currentCompany!.id)
      .eq("child_id", childId)
      .order("week_start_date", { ascending: false });
    setHistoryResults(data || []);
    setHistoryLoading(false);
  };

  const visibleSignups = useMemo(() => {
    const divisionFilter = getDivisionFilter();
    if (divisionFilter === null) return signups;
    const accessibleIds = new Set(allChildren.map((c) => c.id));
    return signups.filter((s) => accessibleIds.has(s.child_id));
  }, [signups, allChildren, userDivisionsKey]);

  const filteredHistoryChildren = useMemo(() => {
    let filtered = allChildren;
    if (historyDivision !== "all") {
      filtered = filtered.filter((c) =>
        camperMatchesDivisionFilter(
          c.division_id,
          divisionNameForId(c.division_id, divisions),
          historyDivision,
          divisionNameForId(historyDivision, divisions),
        ),
      );
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(q));
    }
    return filtered;
  }, [allChildren, historyDivision, historySearch, divisions]);

  const historyChildName = allChildren.find((c) => c.id === historyChildId)?.name;

  const periodLabel = PERIODS.find((p) => p.id === selectedPeriod);

  // Rosters: group signups by elective
  const rostersByElective = useMemo(() => {
    const grouped: Record<string, { name: string; campers: any[] }> = {};
    visibleSignups.forEach((s) => {
      const eName = (s.electives as any)?.name || "Unknown";
      const eId = s.elective_id;
      if (!grouped[eId]) grouped[eId] = { name: eName, campers: [] };
      grouped[eId].campers.push(s);
    });
    return Object.entries(grouped).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [visibleSignups]);

  // Analytics: elective popularity
  const analyticsData = useMemo(() => {
    let filtered = visibleSignups;
    if (analyticsDivision !== "all") {
      filtered = visibleSignups.filter((s) =>
        signupMatchesDivisionFilter(s, analyticsDivision, divisions, allChildren),
      );
    }
    const counts: Record<string, number> = {};
    filtered.forEach((s) => {
      const name = (s.electives as any)?.name || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [visibleSignups, analyticsDivision, divisions, allChildren]);

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
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  value={newElectiveCapacity}
                  onChange={(e) => setNewElectiveCapacity(e.target.value ? parseInt(e.target.value) : "")}
                  placeholder="Max campers"
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
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4`}>
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" onClick={() => setSelectedDate(shiftElectiveCalendarDate(selectedDate, -1))}>
                    ‹
                  </Button>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(normalizeElectiveCalendarDate(e.target.value))}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => setSelectedDate(shiftElectiveCalendarDate(selectedDate, 1))}>
                    ›
                  </Button>
                </div>
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
              {format(parseISO(selectedDate), "EEEE, MMM d, yyyy")} — {periodLabel.label} ({periodLabel.time})
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
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />Camper History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings2 className="h-4 w-4" />Manage Electives
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
                            <SelectTrigger className="w-56">
                              <SelectValue placeholder="Select elective" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {electives.map((e) => {
                                const count = signupCountByElective[e.id] || 0;
                                const cap = (e as any).capacity;
                                const isFull = cap != null && count >= cap;
                                return (
                                  <SelectItem key={e.id} value={e.id} disabled={isFull && signup?.elective_id !== e.id}>
                                    {e.name} {cap != null ? `(${count}/${cap})` : `(${count})`}
                                  </SelectItem>
                                );
                              })}
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
                              {resolveSignupChildName(c, allChildren)}
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

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Select Camper</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search campers..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={historyDivision} onValueChange={setHistoryDivision}>
                  <SelectTrigger><SelectValue placeholder="All Divisions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="max-h-[400px] overflow-y-auto space-y-0.5">
                  {filteredHistoryChildren.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => fetchCamperHistory(child.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        historyChildId === child.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                  {filteredHistoryChildren.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">No campers found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{historyChildName ? `${historyChildName}'s Elective History` : "Camper History"}</CardTitle>
              </CardHeader>
              <CardContent>
                {!historyChildId ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <History className="h-10 w-10 mb-3 opacity-40" />
                    <p>Select a camper to view their elective history</p>
                  </div>
                ) : historyLoading ? (
                  <p className="text-muted-foreground text-center py-8">Loading...</p>
                ) : historyResults.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No elective history found for this camper</p>
                ) : (
                  <div className="space-y-1">
                    <div className="grid grid-cols-[1fr_1fr_1.5fr] gap-4 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                      <span>Date</span>
                      <span>Period</span>
                      <span>Elective</span>
                    </div>
                    {historyResults.map((r) => {
                      const pInfo = PERIODS.find((p) => p.id === r.period);
                      const daysMap: Record<string, number> = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
                      const exactDate = format(addDays(parseISO(r.week_start_date), daysMap[r.day_of_week] || 0), "MMM d, yyyy");
                      return (
                        <div key={r.id} className="grid grid-cols-[1fr_1fr_1.5fr] gap-4 px-3 py-2.5 text-sm rounded-md hover:bg-muted/30 border-b last:border-b-0 items-center">
                          <span>{r.day_of_week}, {exactDate}</span>
                          <span>{pInfo?.label || r.period}</span>
                          <div>
                            <Badge variant="secondary">{(r.electives as any)?.name || "Unknown"}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SETTINGS / MANAGE ELECTIVES TAB */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Manage Electives & Capacities</CardTitle>
            </CardHeader>
            <CardContent>
              {electives.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No electives yet. Add one above.</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_120px_100px_80px] gap-4 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                    <span>Elective</span>
                    <span>Capacity</span>
                    <span>Enrolled</span>
                    <span>Actions</span>
                  </div>
                  {electives.map((e) => {
                    const count = signupCountByElective[e.id] || 0;
                    const cap = (e as any).capacity;
                    const editCap = editingCapacities[e.id];
                    const currentCap = editCap !== undefined ? editCap : (cap ?? "");
                    return (
                      <div key={e.id} className="grid grid-cols-[1fr_120px_100px_80px] gap-4 items-center px-3 py-2.5 rounded-md border hover:bg-muted/30">
                        <span className="font-medium text-sm">{e.name}</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            className="h-8 w-20"
                            value={currentCap}
                            onChange={(ev) => setEditingCapacities((prev) => ({ ...prev, [e.id]: ev.target.value ? parseInt(ev.target.value) : "" }))}
                            onBlur={() => handleSaveCapacity(e.id)}
                            onKeyDown={(ev) => ev.key === "Enter" && handleSaveCapacity(e.id)}
                          />
                        </div>
                        <Badge variant={cap != null && count >= cap ? "destructive" : "secondary"}>
                          {count}{cap != null ? `/${cap}` : ""}
                        </Badge>
                        <button onClick={() => handleDeleteElective(e.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
