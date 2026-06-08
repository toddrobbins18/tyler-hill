import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EvaluateCamperDialog from "./dialogs/EvaluateCamperDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCompany } from "@/contexts/CompanyContext";

interface CamperReportsTabProps {
  childId: string;
  reportType: '10_day' | 'end_of_summer';
}

export default function CamperReportsTab({ childId, reportType }: CamperReportsTabProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  useEffect(() => {
    fetchReports();
  }, [childId, reportType, currentCompany?.id]);

  const fetchReports = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('camper_reports')
        .select(`
          *,
          created_by_profile:profiles!camper_reports_created_by_fkey(full_name)
        `)
        .eq('child_id', childId)
        .eq('report_type', reportType)
        .eq('company_id', currentCompany.id)
        .order('report_date', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast({ title: "Error loading reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;

    try {
      const { error } = await supabase
        .from('camper_reports')
        .delete()
        .eq('id', reportToDelete);

      if (error) throw error;

      toast({ title: "Report deleted successfully" });
      fetchReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      toast({ title: "Error deleting report", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  const reportTypeName = reportType === '10_day' ? '10-Day Report' : 'End of Summer Report';

  if (loading) {
    return <div className="text-center py-8">Loading reports...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{reportTypeName}s</h3>
          <p className="text-sm text-muted-foreground">
            {reports.length} report{reports.length !== 1 ? 's' : ''} on file
          </p>
        </div>
        <Button onClick={() => {
          setEditingReport(null);
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Report
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No {reportTypeName.toLowerCase()}s recorded yet</p>
            <p className="text-sm mt-1">Click "Add New Report" to create one</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.id} className="shadow-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{reportTypeName}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(report.report_date).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEditingReport(report);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setReportToDelete(report.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-muted-foreground">Created by: </span>
                    <span className="font-medium">
                      {report.created_by_profile?.full_name || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created: </span>
                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                  {report.updated_at !== report.created_at && (
                    <div>
                      <span className="text-muted-foreground">Last updated: </span>
                      <span>{new Date(report.updated_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EvaluateCamperDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        childId={childId}
        reportType={reportType}
        existingReport={editingReport}
        onSuccess={() => {
          fetchReports();
          setDialogOpen(false);
          setEditingReport(null);
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this {reportTypeName.toLowerCase()}.
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
