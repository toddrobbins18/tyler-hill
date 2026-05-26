import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Users, Wand2, Search, UserCheck } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  staff_type: string | null;
  division_id: string | null;
  email: string | null;
}

interface LeaderAssignment {
  staff_id: string;
  leader_id: string;
}

interface Division {
  id: string;
  name: string;
  gender: string;
  sort_order: number;
}

interface BulkLeaderAssignmentDialogProps {
  onSuccess?: () => void;
}

export function BulkLeaderAssignmentDialog({ onSuccess }: BulkLeaderAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<LeaderAssignment[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeader, setSelectedLeader] = useState<string>("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);

    const [staffResult, divisionResult, assignmentResult] = await Promise.all([
      supabase
        .from("staff")
        .select("id, name, role, staff_type, division_id, email")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .neq("status", "inactive")
        .neq("name", "Unknown")
        .not("name", "is", null)
        .order("name"),
      supabase
        .from("divisions")
        .select("id, name, gender, sort_order")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("staff_leader_assignments")
        .select("staff_id, leader_id")
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason),
    ]);

    setAllStaff(staffResult.data || []);
    setDivisions(divisionResult.data || []);
    setAssignments(assignmentResult.data || []);
    setLoading(false);
  };

  // Get all leader IDs for a staff member (many-to-many)
  const getLeaderIdsForStaff = (staffId: string): string[] => {
    return assignments
      .filter(a => a.staff_id === staffId)
      .map(a => a.leader_id);
  };

  // Get all staff IDs assigned to a leader
  const getStaffIdsForLeader = (leaderId: string): string[] => {
    return assignments
      .filter(a => a.leader_id === leaderId)
      .map(a => a.staff_id);
  };

  // Identify potential leaders
  const potentialLeaders = useMemo(() => {
    const leaderIds = new Set(assignments.map(a => a.leader_id));
    return allStaff.filter(s =>
      s.role?.match(/division leader|director|lead |head |asst\. |assistant /i) ||
      leaderIds.has(s.id)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [allStaff, assignments]);

  // Division leaders specifically
  const divisionLeaders = useMemo(() => {
    return allStaff.filter(s =>
      s.role?.match(/^division leader$/i) || s.role?.match(/^assistant division leader$/i)
    );
  }, [allStaff]);

  // Division assignment stats
  const divisionStats = useMemo(() => {
    return divisions.map(div => {
      const staffInDiv = allStaff.filter(s => s.division_id === div.id);
      const dlInDiv = staffInDiv.filter(s =>
        s.role?.match(/division leader/i)
      );
      const gcsInDiv = staffInDiv.filter(s =>
        s.staff_type === "general_counselor" || s.staff_type === "both"
      );
      // A GC is "assigned" if they have at least one leader assignment
      const assignedGcs = gcsInDiv.filter(s => getLeaderIdsForStaff(s.id).length > 0);

      return {
        division: div,
        divisionLeaders: dlInDiv,
        totalGCs: gcsInDiv.length,
        assignedGCs: assignedGcs.length,
        totalStaff: staffInDiv.length,
      };
    });
  }, [divisions, allStaff, assignments]);

  // When a leader is selected, pre-check their currently assigned staff
  useEffect(() => {
    if (selectedLeader) {
      const alreadyAssigned = new Set(getStaffIdsForLeader(selectedLeader));
      setSelectedStaffIds(alreadyAssigned);
    } else {
      setSelectedStaffIds(new Set());
    }
  }, [selectedLeader, assignments]);

  // Filter assignable staff (exclude the selected leader themselves)
  // IMPORTANT: Do NOT filter out staff assigned to other leaders
  const assignableStaff = useMemo(() => {
    let filtered = allStaff.filter(s => s.id !== selectedLeader);

    if (filterType === "general_counselor") {
      filtered = filtered.filter(s => s.staff_type === "general_counselor" || s.staff_type === "both");
    } else if (filterType === "specialist") {
      filtered = filtered.filter(s => s.staff_type === "specialist" || s.staff_type === "both");
    } else if (filterType === "unassigned") {
      filtered = filtered.filter(s => getLeaderIdsForStaff(s.id).length === 0);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(term) ||
        (s.role?.toLowerCase() || "").includes(term)
      );
    }

    return filtered;
  }, [allStaff, selectedLeader, filterType, searchTerm, assignments]);

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(staffId)) {
        next.delete(staffId);
      } else {
        next.add(staffId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set(assignableStaff.map(s => s.id));
    setSelectedStaffIds(allIds);
  };

  const deselectAll = () => {
    setSelectedStaffIds(new Set());
  };

  const handleAutoAssignByDivision = async () => {
    setSaving(true);
    let totalAssigned = 0;

    for (const stat of divisionStats) {
      if (stat.divisionLeaders.length === 0) continue;

      const dl = stat.divisionLeaders[0];

      // Find GCs in this division not already assigned to this DL
      const currentlyAssignedToThisDL = new Set(getStaffIdsForLeader(dl.id));
      const gcsToAssign = allStaff.filter(s =>
        s.division_id === stat.division.id &&
        (s.staff_type === "general_counselor" || s.staff_type === "both") &&
        !currentlyAssignedToThisDL.has(s.id) &&
        s.id !== dl.id
      );

      if (gcsToAssign.length === 0) continue;

      const records = gcsToAssign.map(s => ({
        staff_id: s.id,
        leader_id: dl.id,
        company_id: currentCompany!.id,
        season: currentSeason,
      }));

      const { error } = await supabase
        .from("staff_leader_assignments")
        .upsert(records, { onConflict: "staff_id,leader_id,company_id,season" });

      if (error) {
        console.error("Auto-assign error for division", stat.division.name, error);
      } else {
        totalAssigned += gcsToAssign.length;
      }
    }

    toast({
      title: "Auto-Assignment Complete",
      description: totalAssigned > 0
        ? `Assigned ${totalAssigned} counselors to their Division Leaders.`
        : "No new assignments were made. Ensure Division Leaders have division_id and staff have staff_type set.",
    });

    await fetchData();
    setSaving(false);
    onSuccess?.();
  };

  const handleSaveManualAssignment = async () => {
    if (!selectedLeader || !currentCompany?.id) return;
    setSaving(true);

    const currentlyAssigned = new Set(getStaffIdsForLeader(selectedLeader));

    const toAssign = [...selectedStaffIds].filter(id => !currentlyAssigned.has(id));
    const toUnassign = [...currentlyAssigned].filter(id => !selectedStaffIds.has(id));

    let errors = 0;

    // Add new assignments
    if (toAssign.length > 0) {
      const records = toAssign.map(staffId => ({
        staff_id: staffId,
        leader_id: selectedLeader,
        company_id: currentCompany.id,
        season: currentSeason,
      }));
      const { error } = await supabase
        .from("staff_leader_assignments")
        .upsert(records, { onConflict: "staff_id,leader_id,company_id,season" });
      if (error) errors++;
    }

    // Remove unassigned (only for THIS leader, not others)
    if (toUnassign.length > 0) {
      const { error } = await supabase
        .from("staff_leader_assignments")
        .delete()
        .eq("leader_id", selectedLeader)
        .eq("company_id", currentCompany.id)
        .eq("season", currentSeason)
        .in("staff_id", toUnassign);
      if (error) errors++;
    }

    if (errors > 0) {
      toast({ title: "Error", description: "Some assignments failed.", variant: "destructive" });
    } else {
      const leaderName = allStaff.find(s => s.id === selectedLeader)?.name || "Leader";
      toast({
        title: "Assignments Saved",
        description: `${toAssign.length} assigned, ${toUnassign.length} unassigned for ${leaderName}.`,
      });
    }

    await fetchData();
    setSaving(false);
    onSuccess?.();
  };

  const getDivisionName = (divisionId: string | null) => {
    if (!divisionId) return "—";
    return divisions.find(d => d.id === divisionId)?.name || "—";
  };

  const getLeaderNames = (staffId: string) => {
    const leaderIds = getLeaderIdsForStaff(staffId);
    if (leaderIds.length === 0) return null;
    return leaderIds
      .map(lid => allStaff.find(s => s.id === lid)?.name)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4 mr-2" />
        Assign Leaders
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leader Assignments</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Tabs defaultValue="division" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="division">Auto-Assign by Division</TabsTrigger>
                <TabsTrigger value="manual">Manual Assignment</TabsTrigger>
              </TabsList>

              {/* TAB 1: Auto-Assign by Division */}
              <TabsContent value="division" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Auto-assigns General Counselors to the Division Leader in their division.
                    Staff must have <strong>division_id</strong> and <strong>staff_type</strong> set.
                  </p>
                  <Button
                    onClick={handleAutoAssignByDivision}
                    disabled={saving}
                    className="shrink-0"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    {saving ? "Assigning..." : "Auto-Assign All"}
                  </Button>
                </div>

                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {divisionStats.map(stat => (
                      <div
                        key={stat.division.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{stat.division.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {stat.totalStaff} staff • {stat.totalGCs} GCs
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {stat.divisionLeaders.length > 0 ? (
                            <Badge variant="secondary">
                              <UserCheck className="h-3 w-3 mr-1" />
                              {stat.divisionLeaders.map(dl => dl.name).join(", ")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              No Division Leader
                            </Badge>
                          )}
                          <Badge variant={stat.assignedGCs === stat.totalGCs && stat.totalGCs > 0 ? "default" : "outline"}>
                            {stat.assignedGCs}/{stat.totalGCs} assigned
                          </Badge>
                        </div>
                      </div>
                    ))}

                    {divisionStats.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No divisions found. Create divisions first.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* TAB 2: Manual Assignment */}
              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Leader</label>
                    <Select value={selectedLeader} onValueChange={setSelectedLeader}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a leader to assign staff to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {potentialLeaders.map(leader => (
                          <SelectItem key={leader.id} value={leader.id}>
                            {leader.name} — {leader.role || "No role"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedLeader && (
                    <>
                      <div className="flex gap-2 flex-wrap items-center">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search staff..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Staff</SelectItem>
                            <SelectItem value="general_counselor">General Counselors</SelectItem>
                            <SelectItem value="specialist">Specialists</SelectItem>
                            <SelectItem value="unassigned">Unassigned Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {selectedStaffIds.size} selected of {assignableStaff.length} shown
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={selectAll}>
                            Select All
                          </Button>
                          <Button variant="outline" size="sm" onClick={deselectAll}>
                            Deselect All
                          </Button>
                        </div>
                      </div>

                      <ScrollArea className="h-[350px] border rounded-lg">
                        <div className="divide-y">
                          {assignableStaff.map(staff => {
                            const isChecked = selectedStaffIds.has(staff.id);
                            const otherLeaders = getLeaderIdsForStaff(staff.id)
                              .filter(lid => lid !== selectedLeader);
                            const otherLeaderNames = otherLeaders
                              .map(lid => allStaff.find(s => s.id === lid)?.name)
                              .filter(Boolean);

                            return (
                              <label
                                key={staff.id}
                                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 ${
                                  isChecked ? "bg-primary/5" : ""
                                }`}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggleStaff(staff.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{staff.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {staff.role || "No role"} • {getDivisionName(staff.division_id)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {staff.staff_type && (
                                    <Badge variant="outline" className="text-xs">
                                      {staff.staff_type === "general_counselor" ? "GC" :
                                       staff.staff_type === "specialist" ? "Spec" :
                                       staff.staff_type === "both" ? "Both" : staff.staff_type}
                                    </Badge>
                                  )}
                                  {otherLeaderNames.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      Also → {otherLeaderNames.join(", ")}
                                    </Badge>
                                  )}
                                </div>
                              </label>
                            );
                          })}

                          {assignableStaff.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              No staff match your filters.
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={handleSaveManualAssignment}
                    disabled={saving || !selectedLeader}
                  >
                    {saving ? "Saving..." : "Save Assignments"}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
