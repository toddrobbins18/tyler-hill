import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Users, Plus, Trash2, Search, Edit, Copy } from "lucide-react";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";

interface RosterTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  roster_template_children: { child_id: string }[];
}

interface Child {
  id: string;
  name: string;
  division_id: string | null;
  division?: { name: string; gender: string } | null;
}

export default function RosterTemplates() {
  const { currentSeason } = useSeasonContext();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<RosterTemplate[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RosterTemplate | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

  // Form states
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchData();
    }
  }, [currentCompany?.id, currentSeason]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [templatesResult, childrenResult, divisionsResult] = await Promise.all([
        supabase
          .from("roster_templates")
          .select(`*, roster_template_children(child_id)`)
          .eq("company_id", currentCompany?.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("children")
          .select(`id, name, division_id, division:divisions(name, gender)`)
          .eq("company_id", currentCompany?.id)
          .eq("season", currentSeason)
          .neq("status", "inactive")
          .order("name"),
        supabase
          .from("divisions")
          .select("*")
          .eq("company_id", currentCompany?.id)
          .eq("is_active", true)
      ]);

      setTemplates(templatesResult.data || []);
      setChildren(childrenResult.data || []);
      setDivisions(sortDivisionsAlternatingGender(divisionsResult.data || []));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error loading data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredChildren = children.filter(child => {
    if (searchTerm && !child.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterDivision !== "all" && child.division_id !== filterDivision) {
      return false;
    }
    return true;
  });

  const resetForm = () => {
    setTemplateName("");
    setTemplateDescription("");
    setSelectedChildren(new Set());
    setSearchTerm("");
    setFilterDivision("all");
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: "Please enter a template name", variant: "destructive" });
      return;
    }

    if (selectedChildren.size === 0) {
      toast({ title: "Please select at least one camper", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: template, error: templateError } = await supabase
        .from("roster_templates")
        .insert({
          name: templateName,
          description: templateDescription || null,
          company_id: currentCompany?.id,
        })
        .select()
        .single();

      if (templateError || !template) {
        throw templateError;
      }

      const templateChildren = Array.from(selectedChildren).map(childId => ({
        template_id: template.id,
        child_id: childId,
        company_id: currentCompany?.id,
      }));

      await supabase.from("roster_template_children").insert(templateChildren);

      toast({ title: `Template "${templateName}" created successfully` });
      setShowCreateDialog(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error creating template:", error);
      toast({ title: "Failed to create template", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTemplate = (template: RosterTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description || "");
    setSelectedChildren(new Set(template.roster_template_children.map(c => c.child_id)));
    setShowEditDialog(true);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !templateName.trim()) return;

    if (selectedChildren.size === 0) {
      toast({ title: "Please select at least one camper", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Update template name and description
      await supabase
        .from("roster_templates")
        .update({ name: templateName, description: templateDescription || null })
        .eq("id", editingTemplate.id);

      // Delete existing children and insert new ones
      await supabase
        .from("roster_template_children")
        .delete()
        .eq("template_id", editingTemplate.id);

      const templateChildren = Array.from(selectedChildren).map(childId => ({
        template_id: editingTemplate.id,
        child_id: childId,
        company_id: currentCompany?.id,
      }));

      await supabase.from("roster_template_children").insert(templateChildren);

      toast({ title: "Template updated successfully" });
      setShowEditDialog(false);
      setEditingTemplate(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error updating template:", error);
      toast({ title: "Failed to update template", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplateId) return;

    try {
      await supabase.from("roster_templates").delete().eq("id", deletingTemplateId);
      toast({ title: "Template deleted" });
      setDeletingTemplateId(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  };

  const handleDuplicateTemplate = async (template: RosterTemplate) => {
    setIsSubmitting(true);
    try {
      const { data: newTemplate, error } = await supabase
        .from("roster_templates")
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          company_id: currentCompany?.id,
        })
        .select()
        .single();

      if (error || !newTemplate) throw error;

      if (template.roster_template_children.length > 0) {
        const childrenData = template.roster_template_children.map(c => ({
          template_id: newTemplate.id,
          child_id: c.child_id,
          company_id: currentCompany?.id,
        }));
        await supabase.from("roster_template_children").insert(childrenData);
      }

      toast({ title: "Template duplicated" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Failed to duplicate template", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChildName = (childId: string) => {
    return children.find(c => c.id === childId)?.name || "Unknown";
  };

  // Check if current company is Tyler Hill or Timber Lake Camp
  const isTylerHill = currentCompany?.slug === 'tyler-hill-camp';
  const isTimberLake = currentCompany?.slug === 'timber-lake-camp';

  if (!isTylerHill && !isTimberLake) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Roster Templates</h1>
          <p className="text-muted-foreground">This feature is only available for Tyler Hill Camp and Timber Lake Camp.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Roster Templates</h1>
          <p className="text-muted-foreground">Create and manage reusable roster templates for sporting events</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading templates...</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Roster Templates Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create roster templates to quickly assign campers to sporting events.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDuplicateTemplate(template)}
                      disabled={isSubmitting}
                      title="Duplicate"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditTemplate(template)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingTemplateId(template.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {template.roster_template_children.length} camper{template.roster_template_children.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-[80px] overflow-hidden">
                  {template.roster_template_children.slice(0, 6).map((child, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {getChildName(child.child_id)}
                    </Badge>
                  ))}
                  {template.roster_template_children.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.roster_template_children.length - 6} more
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Created {new Date(template.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Roster Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Soccer A Team"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe this roster..."
                rows={2}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Select Campers ({selectedChildren.size} selected)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedChildren(new Set(filteredChildren.map(c => c.id)))}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedChildren(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search campers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterDivision} onValueChange={setFilterDivision}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto space-y-2">
                {filteredChildren.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No campers found</p>
                ) : (
                  filteredChildren.map((child) => (
                    <div key={child.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded">
                      <Checkbox
                        id={`child-${child.id}`}
                        checked={selectedChildren.has(child.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedChildren);
                          if (checked) {
                            newSet.add(child.id);
                          } else {
                            newSet.delete(child.id);
                          }
                          setSelectedChildren(newSet);
                        }}
                      />
                      <label htmlFor={`child-${child.id}`} className="flex-1 cursor-pointer text-sm">
                        {child.name}
                      </label>
                      {child.division && (
                        <Badge variant="secondary" className="text-xs">{child.division.name}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) { setEditingTemplate(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Roster Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name *</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Soccer A Team"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe this roster..."
                rows={2}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Select Campers ({selectedChildren.size} selected)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedChildren(new Set(filteredChildren.map(c => c.id)))}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedChildren(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search campers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterDivision} onValueChange={setFilterDivision}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisions.map((div) => (
                      <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto space-y-2">
                {filteredChildren.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No campers found</p>
                ) : (
                  filteredChildren.map((child) => (
                    <div key={child.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded">
                      <Checkbox
                        id={`edit-child-${child.id}`}
                        checked={selectedChildren.has(child.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedChildren);
                          if (checked) {
                            newSet.add(child.id);
                          } else {
                            newSet.delete(child.id);
                          }
                          setSelectedChildren(newSet);
                        }}
                      />
                      <label htmlFor={`edit-child-${child.id}`} className="flex-1 cursor-pointer text-sm">
                        {child.name}
                      </label>
                      {child.division && (
                        <Badge variant="secondary" className="text-xs">{child.division.name}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setEditingTemplate(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTemplate} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTemplateId} onOpenChange={(open) => !open && setDeletingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The roster template will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
