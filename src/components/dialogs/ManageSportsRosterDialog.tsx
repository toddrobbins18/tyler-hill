import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Users, Save, X, Pencil, Trash2, UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useConflictDetection, Conflict } from "@/hooks/useConflictDetection";
import ConflictWarningDialog from "./ConflictWarningDialog";

interface ManageSportsRosterDialogProps {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionProvidesCoach?: boolean;
  divisionProvidesRef?: boolean;
  /** When true, show only roster members (no checkboxes or save). */
  readOnly?: boolean;
}

const ROSTER_PAGE_SIZE = 1000;

async function fetchAllSeasonRows<T>(
  table: "children" | "staff",
  companyId: string,
  season: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const to = from + ROSTER_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .neq("status", "inactive")
      .eq("company_id", companyId)
      .eq("season", season)
      .order("name")
      .range(from, to);

    if (error) throw error;

    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < ROSTER_PAGE_SIZE) break;
    from += ROSTER_PAGE_SIZE;
  }

  return rows;
}

export default function ManageSportsRosterDialog({
  eventId,
  eventTitle,
  open,
  onOpenChange,
  divisionProvidesCoach = false,
  divisionProvidesRef = false,
  readOnly = false,
}: ManageSportsRosterDialogProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [children, setChildren] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [roster, setRoster] = useState<Set<string>>(new Set());
  const [assignedCoaches, setAssignedCoaches] = useState<string[]>([]);
  const [assignedRefs, setAssignedRefs] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "age" | "grade">("name");
  const [activeTab, setActiveTab] = useState("campers");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const { checkConflict } = useConflictDetection();
  const [detectedConflicts, setDetectedConflicts] = useState<Conflict[]>([]);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [originalRoster, setOriginalRoster] = useState<Set<string>>(new Set());
  const [eventDetails, setEventDetails] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setActiveTab("campers");
      fetchData();
    }
  }, [open, eventId, currentSeason, readOnly]);

  const fetchData = async () => {
    setLoading(true);
    
    if (!currentCompany?.id) return;

    const { data: rosterData } = await supabase
      .from("sports_event_roster")
      .select("child_id")
      .eq("event_id", eventId);

    const { data: staffAssignments } = await supabase
      .from("sports_event_staff")
      .select("*")
      .eq("event_id", eventId);

    const rosterSet = new Set(rosterData?.map(r => r.child_id) || []);
    const coachIds = staffAssignments?.filter(s => s.role === "coach").map(s => s.staff_id) || [];
    const refIds = staffAssignments?.filter(s => s.role === "ref").map(s => s.staff_id) || [];

    setRoster(rosterSet);
    setOriginalRoster(new Set(rosterSet));
    setAssignedCoaches(coachIds);
    setAssignedRefs(refIds);

    if (readOnly) {
      const rosterIds = Array.from(rosterSet);
      const assignedStaffIds = [...coachIds, ...refIds];

      const [{ data: childrenData }, { data: staffData }] = await Promise.all([
        rosterIds.length > 0
          ? supabase
              .from("children")
              .select("*")
              .in("id", rosterIds)
              .eq("company_id", currentCompany.id)
              .order("name")
          : Promise.resolve({ data: [] as any[] }),
        assignedStaffIds.length > 0
          ? supabase
              .from("staff")
              .select("*")
              .in("id", assignedStaffIds)
              .eq("company_id", currentCompany.id)
              .order("name")
          : Promise.resolve({ data: [] as any[] }),
      ]);

      setChildren(childrenData || []);
      setStaff(staffData || []);
      setTemplates([]);
    } else {
      try {
        const [childrenData, staffData, templatesResult] = await Promise.all([
          fetchAllSeasonRows<any>("children", currentCompany.id, currentSeason),
          fetchAllSeasonRows<any>("staff", currentCompany.id, currentSeason),
          supabase
            .from("roster_templates")
            .select(`
              *,
              roster_template_children(child_id, sort_order)
            `)
            .eq("company_id", currentCompany.id)
            .order("created_at", { ascending: false }),
        ]);

        // Sort children alphabetically by name
        const sortedChildren = [...(childrenData || [])].sort((a, b) => 
          (a.name || "").localeCompare(b.name || "")
        );

        // Sort template children by sort_order
        const processedTemplates = (templatesResult.data || []).map(template => ({
          ...template,
          roster_template_children: (template.roster_template_children || []).sort((a: any, b: any) => 
            (a.sort_order ?? 999) - (b.sort_order ?? 999)
          )
        }));

        setChildren(sortedChildren);
        setStaff(staffData);
        setTemplates(processedTemplates);
      } catch (error) {
        console.error("Error loading roster picker data:", error);
        toast.error("Failed to load campers for roster");
        setChildren([]);
        setStaff([]);
        setTemplates([]);
      }
    }

    setLoading(false);
  };

  const handleToggleChild = (childId: string) => {
    const newRoster = new Set(roster);
    if (newRoster.has(childId)) {
      newRoster.delete(childId);
    } else {
      newRoster.add(childId);
    }
    setRoster(newRoster);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: event } = await supabase.from('sports_calendar').select('*').eq('id', eventId).single();
      
      if (!event) {
        toast.error("Event not found");
        setSaving(false);
        return;
      }

      setEventDetails(event);
      const newChildren = Array.from(roster).filter(childId => !originalRoster.has(childId));
      const allConflicts: Conflict[] = [];
      
      for (const childId of newChildren) {
        const child = children.find(c => c.id === childId);
        const conflicts = await checkConflict({
          entityType: 'child',
          entityId: childId,
          eventType: 'Sports Event',
          eventId: eventId,
          eventDate: event.event_date,
          eventTime: event.time,
          companyId: currentCompany?.id || ''
        });
        
        if (conflicts.length > 0) {
          allConflicts.push(...conflicts.map(c => ({ ...c, entity_name: child?.name || 'Unknown', event1_name: event.title })));
        }
      }
      
      if (allConflicts.length > 0) {
        setDetectedConflicts(allConflicts);
        setShowConflictDialog(true);
        setSaving(false);
        return;
      }
      
      await performSave();
    } catch (error) {
      console.error("Error saving roster:", error);
      toast.error("Failed to save roster");
      setSaving(false);
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
    try {
      if (overrideReason && detectedConflicts.length > 0) {
        const newChildren = Array.from(roster).filter(childId => !originalRoster.has(childId));
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

      // Delete existing roster entries first
      await supabase.from("sports_event_roster").delete().eq("event_id", eventId);
      
      if (roster.size > 0) {
        // Sort roster alphabetically by camper name before saving
        const sortedRosterIds = Array.from(roster)
          .map(childId => {
            const child = children.find(c => c.id === childId);
            return { childId, name: child?.name || "" };
          })
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(item => item.childId);

        // Insert in batches of 100 to avoid request size limits
        const batchSize = 100;
        for (let i = 0; i < sortedRosterIds.length; i += batchSize) {
          const batch = sortedRosterIds.slice(i, i + batchSize);
          const rosterEntries = batch.map((childId, index) => ({
            event_id: eventId,
            child_id: childId,
            confirmed: true,
            company_id: currentCompany?.id,
            sort_order: i + index
          }));
          
          const { error: insertError } = await supabase.from("sports_event_roster").insert(rosterEntries);
          if (insertError) throw insertError;
        }
      }

      await supabase.from("sports_event_staff").delete().eq("event_id", eventId);
      const staffEntries = [
        ...assignedCoaches.map(staffId => ({ event_id: eventId, staff_id: staffId, role: "coach", company_id: currentCompany?.id })),
        ...assignedRefs.map(staffId => ({ event_id: eventId, staff_id: staffId, role: "ref", company_id: currentCompany?.id })),
      ];
      if (staffEntries.length > 0) {
        await supabase.from("sports_event_staff").insert(staffEntries);
      }

      // Notify Health Center & Dining Hall
      const isInitialSubmission = originalRoster.size === 0 && roster.size > 0;
      
      // Check if roster actually changed (not just size)
      let rosterChanged = false;
      if (originalRoster.size !== roster.size) {
        rosterChanged = true;
      } else {
        for (const id of roster) {
          if (!originalRoster.has(id)) {
            rosterChanged = true;
            break;
          }
        }
      }
      
      const isUpdate = originalRoster.size > 0 && rosterChanged;
      
      if (isInitialSubmission || isUpdate) {
        supabase.functions.invoke('send-roster-notification', {
          body: {
            eventId,
            companyId: currentCompany?.id,
            eventTitle,
            rosterCount: roster.size,
            action: isInitialSubmission ? 'submitted' : 'updated'
          }
        }).catch(err => console.error("Failed to invoke send-roster-notification", err));
      }

      toast.success(`Roster updated: ${roster.size} campers, ${assignedCoaches.length} coaches, ${assignedRefs.length} refs`);
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving roster:", error);
      toast.error("Failed to save roster");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    const { data: template, error: templateError } = await supabase
      .from("roster_templates")
      .insert({
        name: templateName,
        description: templateDescription,
        company_id: currentCompany?.id,
      })
      .select()
      .single();

    if (templateError || !template) {
      toast.error("Failed to save template");
      return;
    }

    if (roster.size > 0) {
      const templateChildren = Array.from(roster).map(childId => ({
        template_id: template.id,
        child_id: childId,
        company_id: currentCompany?.id,
      }));
      await supabase.from("roster_template_children").insert(templateChildren);
    }

    toast.success(`Template "${templateName}" saved successfully`);
    setShowSaveTemplate(false);
    setTemplateName("");
    setTemplateDescription("");
    fetchData();
  };

  const handleApplyTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const childIds = template.roster_template_children?.map((rtc: any) => rtc.child_id) || [];
    setRoster(new Set(childIds));
    toast.success(`Applied template: ${template.name}`);
    setActiveTab("campers");
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplateId) return;

    const { error } = await supabase
      .from("roster_templates")
      .delete()
      .eq("id", deletingTemplateId);

    if (error) {
      toast.error("Failed to delete template");
      return;
    }

    toast.success("Template deleted");
    setDeletingTemplateId(null);
    fetchData();
  };

  const filteredAndSortedChildren = children
    .filter(child => 
      child.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "age") {
        return (a.age || 0) - (b.age || 0);
      } else if (sortBy === "grade") {
        return (a.grade || "").localeCompare(b.grade || "");
      }
      return 0;
    });

  const getStaffName = (staffId: string) => {
    return staff.find(s => s.id === staffId)?.name || "Unknown";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {readOnly ? "View" : "Manage"} Roster: {eventTitle}
            </DialogTitle>
          </DialogHeader>

          {/* Allergy Alert Summary */}
          {(() => {
            const campersWithAllergies = Array.from(roster)
              .map(childId => children.find(c => c.id === childId))
              .filter(child => child?.allergies);
            
            const staffWithAllergies = [...assignedCoaches, ...assignedRefs]
              .map(staffId => staff.find(s => s.id === staffId))
              .filter(staffMember => staffMember?.allergies);
            
            const totalAllergies = campersWithAllergies.length + staffWithAllergies.length;
            
            if (totalAllergies === 0) return null;
            
            return (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-destructive mb-1">
                      ALLERGY ALERT: {totalAllergies} individual{totalAllergies > 1 ? 's' : ''} with documented allergies
                    </h4>
                    <p className="text-sm text-destructive/80">
                      {campersWithAllergies.length > 0 && `${campersWithAllergies.length} camper${campersWithAllergies.length > 1 ? 's' : ''}`}
                      {campersWithAllergies.length > 0 && staffWithAllergies.length > 0 && ' and '}
                      {staffWithAllergies.length > 0 && `${staffWithAllergies.length} staff member${staffWithAllergies.length > 1 ? 's' : ''}`}
                    </p>
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-destructive/80 hover:text-destructive">
                        View allergy details
                      </summary>
                      <div className="mt-2 space-y-1 text-xs">
                        {campersWithAllergies.map(child => (
                          <div key={child!.id} className="pl-4">
                            <span className="font-medium">{child!.name} (Camper):</span> {child!.allergies}
                          </div>
                        ))}
                        {staffWithAllergies.map(staffMember => (
                          <div key={staffMember!.id} className="pl-4">
                            <span className="font-medium">{staffMember!.name} (Staff):</span> {staffMember!.allergies}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            );
          })()}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className={`grid w-full ${readOnly ? "grid-cols-2" : "grid-cols-3"}`}>
              <TabsTrigger value="campers">{readOnly ? "Campers" : "Select Campers"}</TabsTrigger>
              <TabsTrigger value="staff">Staff Assignments</TabsTrigger>
              {!readOnly && <TabsTrigger value="templates">Saved Templates</TabsTrigger>}
            </TabsList>

            <TabsContent value="campers" className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Search Campers</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="age">Age</SelectItem>
                    <SelectItem value="grade">Grade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-muted-foreground">
                {readOnly
                  ? `${filteredAndSortedChildren.length} camper${filteredAndSortedChildren.length === 1 ? "" : "s"} on roster`
                  : `${roster.size} of ${filteredAndSortedChildren.length} campers selected`}
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto border rounded-md p-4 space-y-2">
                  {filteredAndSortedChildren.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
                    >
                      {!readOnly && (
                        <Checkbox
                          id={child.id}
                          checked={roster.has(child.id)}
                          onCheckedChange={() => handleToggleChild(child.id)}
                        />
                      )}
                      <label
                        htmlFor={readOnly ? undefined : child.id}
                        className={`flex-1 ${readOnly ? "" : "cursor-pointer"} flex items-center justify-between`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{child.name}</span>
                          {child.allergies && (
                            <Badge variant="destructive" className="text-xs">
                              ⚠️ Allergies
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {child.age && <span>Age: {child.age}</span>}
                          {child.grade && <span>Grade: {child.grade}</span>}
                          {child.group_name && <span>Group: {child.group_name}</span>}
                        </div>
                      </label>
                    </div>
                  ))}
                  {filteredAndSortedChildren.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {readOnly ? "No campers on this roster" : "No campers found"}
                    </div>
                  )}
                </div>
              )}

              {!readOnly && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSaveTemplate(true)}
                  disabled={roster.size === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
              </div>
              )}
            </TabsContent>

            <TabsContent value="staff" className="flex-1 overflow-hidden flex flex-col space-y-6">
              <div className="space-y-4 overflow-y-auto">
                {/* Coaches Section */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Coaches</Label>
                    {divisionProvidesCoach && (
                      <Badge variant="secondary">Division will provide</Badge>
                    )}
                  </div>
                  
                  {!divisionProvidesCoach && !readOnly && (
                    <>
                      <Select
                        value=""
                        onValueChange={(staffId) => {
                          if (!assignedCoaches.includes(staffId)) {
                            setAssignedCoaches([...assignedCoaches, staffId]);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add coach..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.filter(s => !assignedCoaches.includes(s.id)).map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} {s.role && `(${s.role})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="space-y-2">
                        {assignedCoaches.map(coachId => {
                          const coach = staff.find(s => s.id === coachId);
                          return (
                            <div key={coachId} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{coach?.name || "Unknown"}</span>
                                {coach?.allergies && (
                                  <Badge variant="destructive" className="text-xs">
                                    ⚠️ Allergies: {coach.allergies}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setAssignedCoaches(assignedCoaches.filter(id => id !== coachId))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {assignedCoaches.length === 0 && (
                          <p className="text-sm text-muted-foreground">No coaches assigned</p>
                        )}
                      </div>
                    </>
                  )}

                  {!divisionProvidesCoach && readOnly && (
                    <div className="space-y-2">
                      {assignedCoaches.map(coachId => {
                        const coach = staff.find(s => s.id === coachId);
                        return (
                          <div key={coachId} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{coach?.name || "Unknown"}</span>
                              {coach?.allergies && (
                                <Badge variant="destructive" className="text-xs">
                                  ⚠️ Allergies: {coach.allergies}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {assignedCoaches.length === 0 && (
                        <p className="text-sm text-muted-foreground">No coaches assigned</p>
                      )}
                    </div>
                  )}
                  
                  {divisionProvidesCoach && (
                    <p className="text-sm text-muted-foreground">
                      Coach assignment pending - Division will provide
                    </p>
                  )}
                </div>

                {/* Refs Section */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Referees</Label>
                    {divisionProvidesRef && (
                      <Badge variant="secondary">Division will provide</Badge>
                    )}
                  </div>
                  
                  {!divisionProvidesRef && !readOnly && (
                    <>
                      <Select
                        value=""
                        onValueChange={(staffId) => {
                          if (!assignedRefs.includes(staffId)) {
                            setAssignedRefs([...assignedRefs, staffId]);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add referee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staff.filter(s => !assignedRefs.includes(s.id)).map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} {s.role && `(${s.role})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="space-y-2">
                        {assignedRefs.map(refId => {
                          const ref = staff.find(s => s.id === refId);
                          return (
                            <div key={refId} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{ref?.name || "Unknown"}</span>
                                {ref?.allergies && (
                                  <Badge variant="destructive" className="text-xs">
                                    ⚠️ Allergies: {ref.allergies}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => setAssignedRefs(assignedRefs.filter(id => id !== refId))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                        {assignedRefs.length === 0 && (
                          <p className="text-sm text-muted-foreground">No referees assigned</p>
                        )}
                      </div>
                    </>
                  )}

                  {!divisionProvidesRef && readOnly && (
                    <div className="space-y-2">
                      {assignedRefs.map(refId => {
                        const ref = staff.find(s => s.id === refId);
                        return (
                          <div key={refId} className="flex items-center justify-between p-2 bg-muted rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{ref?.name || "Unknown"}</span>
                              {ref?.allergies && (
                                <Badge variant="destructive" className="text-xs">
                                  ⚠️ Allergies: {ref.allergies}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {assignedRefs.length === 0 && (
                        <p className="text-sm text-muted-foreground">No referees assigned</p>
                      )}
                    </div>
                  )}
                  
                  {divisionProvidesRef && (
                    <p className="text-sm text-muted-foreground">
                      Referee assignment pending - Division will provide
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="flex-1 overflow-hidden flex flex-col space-y-4">
              <div className="flex-1 overflow-y-auto space-y-3">
                {templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No saved templates</p>
                    <p className="text-sm mt-2">Create rosters and save them as templates for quick reuse</p>
                  </div>
                ) : (
                  templates.map(template => (
                    <div key={template.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold">{template.name}</h4>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplyTemplate(template.id)}
                          >
                            Apply
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeletingTemplateId(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{template.roster_template_children?.length || 0} campers</span>
                        <span>•</span>
                        <span>Created {new Date(template.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={saving || loading}>
                {saving ? "Saving..." : "Save Roster"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Roster as Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., Varsity Soccer Team"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Brief description of this roster"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>
                Save Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!deletingTemplateId} onOpenChange={(open) => !open && setDeletingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this roster template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConflictWarningDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={detectedConflicts}
        entityName={detectedConflicts[0]?.entity_name || ''}
        onCancel={() => {
          setShowConflictDialog(false);
          setSaving(false);
        }}
        onProceed={async (reason) => {
          await performSave(reason);
          setShowConflictDialog(false);
        }}
      />
    </>
  );
}
