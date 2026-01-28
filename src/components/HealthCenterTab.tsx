import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Hospital, Pill, Clock, Calendar, User, FileText } from "lucide-react";
import { format } from "date-fns";

interface HealthCenterTabProps {
  entityId: string;
  entityType: "child" | "staff";
}

export function HealthCenterTab({ entityId, entityType }: HealthCenterTabProps) {
  const { currentCompany } = useCompany();
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (entityId && currentCompany?.id) {
      fetchHealthData();
    }
  }, [entityId, currentCompany?.id]);

  const fetchHealthData = async () => {
    setLoading(true);
    
    try {
      // Fetch health center admissions
      let admissionsQuery = supabase
        .from("health_center_admissions")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("admitted_at", { ascending: false });

      if (entityType === "child") {
        admissionsQuery = admissionsQuery.eq("child_id", entityId);
      } else {
        admissionsQuery = admissionsQuery.eq("staff_id", entityId);
      }

      const { data: admissionsData } = await admissionsQuery;
      setAdmissions(admissionsData || []);

      // Fetch medications (only for children)
      if (entityType === "child") {
        const { data: medsData } = await supabase
          .from("medication_logs")
          .select("*")
          .eq("child_id", entityId)
          .eq("company_id", currentCompany?.id)
          .order("date", { ascending: false })
          .limit(50);

        setMedications(medsData || []);
      }
    } catch (error) {
      console.error("Error fetching health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getAdmissionDuration = (admittedAt: string, checkedOutAt?: string | null) => {
    const start = new Date(admittedAt);
    const end = checkedOutAt ? new Date(checkedOutAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m`;
    }
    return `${diffMins}m`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const currentAdmission = admissions.find(a => !a.checked_out_at);
  const pastAdmissions = admissions.filter(a => a.checked_out_at);

  return (
    <div className="space-y-6">
      {/* Current Admission Status */}
      {currentAdmission ? (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Hospital className="h-5 w-5" />
              Currently in Health Center
            </CardTitle>
            <CardDescription>Admitted {format(new Date(currentAdmission.admitted_at), "PPpp")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 rounded-lg bg-background">
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium">{currentAdmission.reason || "Not specified"}</p>
              </div>
              <div className="p-3 rounded-lg bg-background">
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{getAdmissionDuration(currentAdmission.admitted_at)}</p>
              </div>
              {currentAdmission.notes && (
                <div className="p-3 rounded-lg bg-background md:col-span-2">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{currentAdmission.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-success/50 bg-success/5">
          <CardContent className="py-6 flex items-center gap-3">
            <div className="p-2 rounded-full bg-success/20">
              <Hospital className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-success">Not Currently Admitted</p>
              <p className="text-sm text-muted-foreground">No active Health Center stay</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Admission History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Admission History
            </CardTitle>
            <CardDescription>{pastAdmissions.length} past visit{pastAdmissions.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {pastAdmissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No previous Health Center visits</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {pastAdmissions.map((admission) => (
                  <div key={admission.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {format(new Date(admission.admitted_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getAdmissionDuration(admission.admitted_at, admission.checked_out_at)}
                      </Badge>
                    </div>
                    {admission.reason && (
                      <p className="text-sm text-muted-foreground">{admission.reason}</p>
                    )}
                    {admission.notes && (
                      <div className="flex items-start gap-2 pt-1 border-t text-xs text-muted-foreground">
                        <FileText className="h-3 w-3 mt-0.5" />
                        <span>{admission.notes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Medications (for children only) */}
        {entityType === "child" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Medication History
              </CardTitle>
              <CardDescription>Recent medication records</CardDescription>
            </CardHeader>
            <CardContent>
              {medications.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No medication records</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {medications.map((med) => (
                    <div key={med.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{med.medication_name}</span>
                        <Badge 
                          variant={med.administered ? "default" : "outline"}
                          className={med.administered ? "bg-success text-success-foreground" : ""}
                        >
                          {med.administered ? "Administered" : "Pending"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(med.date + "T00:00:00"), "MMM d, yyyy")}
                        </span>
                        {med.dosage && (
                          <span>• {med.dosage}</span>
                        )}
                        {med.meal_time && med.meal_time.length > 0 && (
                          <span>• {med.meal_time.join(", ")}</span>
                        )}
                      </div>
                      {med.notes && (
                        <p className="text-xs text-muted-foreground border-t pt-1 mt-1">{med.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats for Staff */}
        {entityType === "staff" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Health Summary
              </CardTitle>
              <CardDescription>Overall health center statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total Visits</p>
                <p className="text-2xl font-bold">{admissions.length}</p>
              </div>
              {admissions.length > 0 && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Last Visit</p>
                  <p className="text-lg font-medium">
                    {format(new Date(admissions[0].admitted_at), "MMM d, yyyy")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
