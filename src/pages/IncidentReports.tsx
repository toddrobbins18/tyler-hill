import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AddIncidentDialog from "@/components/dialogs/AddIncidentDialog";
import EditIncidentDialog from "@/components/dialogs/EditIncidentDialog";
import { CSVUploader } from "@/components/CSVUploader";
import { JSONUploader } from "@/components/JSONUploader";
import { useSeason } from "@/contexts/SeasonContext";

export default function IncidentReports() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingIncident, setEditingIncident] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { selectedSeason } = useSeason();

  useEffect(() => {
    fetchIncidents();

    const channel = supabase
      .channel('incident-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_reports' },
        () => fetchIncidents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedSeason]);

  const fetchIncidents = async () => {
    const { data, error } = await supabase
      .from("incident_reports")
      .select(`
        *,
        incident_children(
          child_id,
          children(name)
        ),
        staff(name)
      `)
      .or(`season.eq.${selectedSeason},season.is.null`)
      .order("date", { ascending: false });

    if (error) {
      toast({ title: "Error fetching incidents", variant: "destructive" });
      setLoading(false);
      return;
    }
    setIncidents(data || []);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const { error } = await supabase
      .from("incident_reports")
      .delete()
      .eq("id", deletingId);

    if (error) {
      toast({ title: "Error deleting incident", variant: "destructive" });
      return;
    }

    toast({ title: "Incident report deleted" });
    setDeletingId(null);
    fetchIncidents();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Incident Reports</h1>
          <p className="text-muted-foreground">Track and manage incident reports</p>
        </div>
        <div className="flex gap-2">
          <CSVUploader tableName="incident_reports" onUploadComplete={fetchIncidents} />
          <JSONUploader tableName="incident_reports" onUploadComplete={fetchIncidents} />
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Incident
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : incidents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No incident reports found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {incidents.map((incident) => (
            <Card key={incident.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {incident.incident_children?.map((ic: any) => ic.children?.name).join(", ") || "No children assigned"}
                    </CardTitle>
                    <CardDescription>{new Date(incident.date).toLocaleDateString()}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingIncident(incident)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingId(incident.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getSeverityColor(incident.severity)}>
                    {incident.severity || 'Not Set'}
                  </Badge>
                  <Badge variant="outline">{incident.type}</Badge>
                  {incident.tags?.map((tag: string) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {incident.description}
                </p>
                {(incident.staff?.name || incident.reported_by) && (
                  <p className="text-xs text-muted-foreground">
                    Reported by: {incident.staff?.name || incident.reported_by}
                  </p>
                )}
                <Badge variant={incident.status === 'open' ? 'default' : 'secondary'}>
                  {incident.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddIncidentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchIncidents}
      />

      {editingIncident && (
        <EditIncidentDialog
          open={!!editingIncident}
          onOpenChange={(open) => !open && setEditingIncident(null)}
          incident={editingIncident}
          onSuccess={fetchIncidents}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Incident Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this incident report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
