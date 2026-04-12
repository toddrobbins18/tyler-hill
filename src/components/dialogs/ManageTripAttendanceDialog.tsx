import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useConflictDetection, Conflict } from "@/hooks/useConflictDetection";
import ConflictWarningDialog from "./ConflictWarningDialog";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";

interface ManageTripAttendanceDialogProps {
  tripId: string | null;
  tripName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ManageTripAttendanceDialog({
  tripId,
  tripName,
  open,
  onOpenChange,
}: ManageTripAttendanceDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { checkConflict } = useConflictDetection();
  const [children, setChildren] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<Set<string>>(new Set());
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectedConflicts, setDetectedConflicts] = useState<Conflict[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [originalAttendees, setOriginalAttendees] = useState<Set<string>>(new Set());
  const [tripDetails, setTripDetails] = useState<any>(null);

  useEffect(() => {
    if (open && tripId) {
      fetchDivisionsAndChildren();
      fetchAttendees();
    }
  }, [open, tripId, currentSeason]);

  const fetchDivisionsAndChildren = async () => {
    if (!currentCompany?.id) return;
    const { data: divisionsData } = await supabase
      .from("divisions")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true);

    const { data: childrenData } = await supabase
      .from("children")
      .select("*, division:divisions(*)")
      .eq("status", "active")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("name");

    if (divisionsData) setDivisions(sortDivisionsAlternatingGender(divisionsData));
    if (childrenData) setChildren(childrenData);
  };

  const fetchAttendees = async () => {
    if (!tripId) return;

    const { data } = await supabase
      .from("trip_attendees")
      .select("child_id")
      .eq("trip_id", tripId);

    if (data) {
      const attendeeSet = new Set(data.map((a) => a.child_id));
      setAttendees(attendeeSet);
      setOriginalAttendees(new Set(attendeeSet));
    }
  };

  const toggleAttendee = (childId: string) => {
    const newAttendees = new Set(attendees);
    if (newAttendees.has(childId)) {
      newAttendees.delete(childId);
    } else {
      newAttendees.add(childId);
    }
    setAttendees(newAttendees);
  };

  const handleSubmit = async () => {
    if (!tripId) return;
    setLoading(true);

    try {
      const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
      
      if (!trip) {
        toast.error("Trip not found");
        setLoading(false);
        return;
      }

      setTripDetails(trip);
      const newChildren = Array.from(attendees).filter(childId => !originalAttendees.has(childId));
      const allConflicts: Conflict[] = [];
      
      for (const childId of newChildren) {
        const child = children.find(c => c.id === childId);
        const conflicts = await checkConflict({
          entityType: 'child',
          entityId: childId,
          eventType: 'Trip',
          eventId: tripId,
          eventDate: trip.date,
          eventTime: trip.departure_time,
          companyId: currentCompany?.id || ''
        });
        
        if (conflicts.length > 0) {
          allConflicts.push(...conflicts.map(c => ({ ...c, entity_name: child?.name || 'Unknown', event1_name: trip.name })));
        }
      }
      
      if (allConflicts.length > 0) {
        setDetectedConflicts(allConflicts);
        setShowConflictDialog(true);
        setLoading(false);
        return;
      }
      
      await performSave();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update roster");
      setLoading(false);
    }
  };

  const notifyDivisionLeaders = async (conflicts: Conflict[], overrideReason: string, affectedChildIds: string[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: childrenData } = await supabase
        .from('children')
        .select('id, name, leader_id')
        .in('id', affectedChildIds);
      
      for (const child of childrenData || []) {
        if (!child.leader_id) continue;
        
        const childConflicts = conflicts.filter(c => c.entity_name === child.name);
        if (childConflicts.length === 0) continue;
        
        const subject = `⚠️ Schedule Conflict Override - ${child.name}`;
        const message = `A schedule conflict was detected and overridden for ${child.name}.

**Conflicts:**
${childConflicts.map(c => `• ${c.event1_name} (${c.event1_date}${c.event1_time ? ' ' + c.event1_time : ''})
  vs ${c.event2_name} (${c.event2_date}${c.event2_time ? ' ' + c.event2_time : ''})`).join('\n')}

**Override Reason:** ${overrideReason}

**Assigned by:** ${user?.email || 'Unknown'}
**Time:** ${new Date().toLocaleString()}

Please review this conflict and take appropriate action.`;
        
        await supabase.from('messages').insert({
          recipient_id: child.leader_id,
          sender_id: user?.id || null,
          subject,
          content: message,
          notification_type: 'alert',
          read: false,
          company_id: currentCompany?.id
        });
      }
    } catch (error) {
      console.error('Error notifying division leaders:', error);
    }
  };

  const performSave = async (overrideReason?: string) => {
    if (!tripId) return;
    
    try {
      if (overrideReason && detectedConflicts.length > 0) {
        const newChildren = Array.from(attendees).filter(childId => !originalAttendees.has(childId));
        for (const childId of newChildren) {
          const conflictsForChild = detectedConflicts.filter(c => c.entity_name === children.find(ch => ch.id === childId)?.name);
          for (const conflict of conflictsForChild) {
            await supabase.from('schedule_conflicts').insert({
              entity_id: childId,
              entity_name: conflict.entity_name,
              entity_type: 'child',
              conflict_type: conflict.conflict_type,
              event1_type: conflict.event1_type,
              event1_id: conflict.event1_id,
              event1_name: conflict.event1_name,
              event1_date: conflict.event1_date,
              event1_time: conflict.event1_time,
              event2_type: conflict.event2_type,
              event2_id: conflict.event2_id,
              event2_name: conflict.event2_name,
              event2_date: conflict.event2_date,
              event2_time: conflict.event2_time,
              override_reason: overrideReason,
              company_id: currentCompany?.id || ''
            });
          }
        }
        
        await notifyDivisionLeaders(detectedConflicts, overrideReason, newChildren);
      }

      await supabase.from("trip_attendees").delete().eq("trip_id", tripId);

      if (attendees.size > 0) {
        const attendeesData = Array.from(attendees).map((childId) => ({
          trip_id: tripId,
          child_id: childId,
          confirmed: true,
          company_id: currentCompany?.id,
        }));

        const { error } = await supabase.from("trip_attendees").insert(attendeesData);
        if (error) throw error;
      }

      toast.success(`Roster updated: ${attendees.size} attendees`);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update roster");
    } finally {
      setLoading(false);
    }
  };

  const filteredChildren = selectedDivision === "all"
    ? children
    : children.filter((child) => child.division_id === selectedDivision);

  const groupedByDivision = children.reduce((acc, child) => {
    const divName = child.division?.name || "No Division";
    if (!acc[divName]) acc[divName] = [];
    acc[divName].push(child);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Manage Roster: {tripName}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="by-division" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="by-division">By Division</TabsTrigger>
            <TabsTrigger value="filter">Filter</TabsTrigger>
          </TabsList>

          <TabsContent value="by-division" className="space-y-4 max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedByDivision).map(([divName, divChildren]: [string, any[]]) => (
              <div key={divName} className="space-y-2">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  {divName}
                  <Badge variant="secondary">
                    {divChildren.filter((c) => attendees.has(c.id)).length} / {divChildren.length}
                  </Badge>
                </Label>
                <div className="grid grid-cols-2 gap-2 pl-4">
                  {divChildren.map((child) => (
                    <div key={child.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`child-${child.id}`}
                        checked={attendees.has(child.id)}
                        onCheckedChange={() => toggleAttendee(child.id)}
                      />
                      <label
                        htmlFor={`child-${child.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {child.name} {child.age ? `(${child.age})` : ""}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="filter" className="space-y-4">
            <div>
              <Label>Filter by Division</Label>
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="w-full px-4 py-2 border rounded-md bg-background"
              >
                <option value="all">All Divisions</option>
                {divisions.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-2">
              <Label className="flex items-center gap-2">
                Selected Campers
                <Badge>{attendees.size} selected</Badge>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {filteredChildren.map((child) => (
                  <div key={child.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`filtered-${child.id}`}
                      checked={attendees.has(child.id)}
                      onCheckedChange={() => toggleAttendee(child.id)}
                    />
                    <label
                      htmlFor={`filtered-${child.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {child.name} - {child.division?.name || "No Division"}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Total selected: {attendees.size} campers
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Roster"}
            </Button>
          </div>
        </div>
      </DialogContent>

      <ConflictWarningDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={detectedConflicts}
        entityName={detectedConflicts[0]?.entity_name || ''}
        onCancel={() => {
          setShowConflictDialog(false);
          setLoading(false);
        }}
        onProceed={async (reason) => {
          await performSave(reason);
          setShowConflictDialog(false);
        }}
      />
    </Dialog>
  );
}
