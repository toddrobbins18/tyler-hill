import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Trophy, Star, Calendar, AlertTriangle, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import EditChildDialog from "@/components/dialogs/EditChildDialog";

export default function ChildProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<any>(null);
  const [awards, setAwards] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchChildData();
    }
  }, [id]);

  const fetchChildData = async () => {
    try {
      // Fetch child details
      const { data: childData, error: childError } = await supabase
        .from("children")
        .select("*")
        .eq("id", id)
        .single();

      if (childError) throw childError;
      setChild(childData);

      // Fetch awards for this child
      const { data: awardsData } = await supabase
        .from("awards")
        .select("*")
        .eq("child_id", id)
        .order("date", { ascending: false });

      setAwards(awardsData || []);

      // Fetch incident reports for this child
      const { data: incidentsData } = await supabase
        .from("incident_reports")
        .select("*")
        .eq("child_id", id)
        .order("date", { ascending: false });

      setIncidents(incidentsData || []);
    } catch (error) {
      console.error("Error fetching child data:", error);
      toast({ title: "Error loading child profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!child) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Child not found</p>
        <Button onClick={() => navigate("/roster")} className="mt-4">
          Back to Campers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/roster")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground mb-1">{child.name}</h1>
          <p className="text-muted-foreground">
            {child.grade && `${child.grade} • `}
            {child.category && `${child.category} • `}
            {child.group_name && `Group ${child.group_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
          <Badge variant="outline" className={child.status === "active" ? "bg-success/10 text-success border-success/20" : ""}>
            {child.status || "Active"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="incidents">Incident Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Basic details and contact information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {child.age && (
                    <div>
                      <p className="text-sm text-muted-foreground">Age</p>
                      <p className="font-medium">{child.age} years old</p>
                    </div>
                  )}
                  {child.grade && (
                    <div>
                      <p className="text-sm text-muted-foreground">Grade</p>
                      <p className="font-medium">{child.grade}</p>
                    </div>
                  )}
                  {child.gender && (
                    <div>
                      <p className="text-sm text-muted-foreground">Gender</p>
                      <p className="font-medium capitalize">{child.gender}</p>
                    </div>
                  )}
                  {child.category && (
                    <div>
                      <p className="text-sm text-muted-foreground">Division</p>
                      <p className="font-medium">{child.category}</p>
                    </div>
                  )}
                </div>
                {(child.allergies || child.medical_notes) && (
                  <div className="pt-3 border-t">
                    {child.allergies && (
                      <div className="mb-2">
                        <p className="text-sm text-muted-foreground">Allergies</p>
                        <p className="font-medium text-destructive">{child.allergies}</p>
                      </div>
                    )}
                    {child.medical_notes && (
                      <div>
                        <p className="text-sm text-muted-foreground">Medical Notes</p>
                        <p className="font-medium">{child.medical_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Emergency contacts and guardian information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {child.guardian_email && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Guardian Email</p>
                    <p className="font-medium">{child.guardian_email}</p>
                  </div>
                )}
                {child.guardian_phone && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Guardian Phone</p>
                    <p className="font-medium">{child.guardian_phone}</p>
                  </div>
                )}
                {child.emergency_contact && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium">{child.emergency_contact}</p>
                  </div>
                )}
                {!child.guardian_email && !child.guardian_phone && !child.emergency_contact && (
                  <p className="text-sm text-muted-foreground">No contact information available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {awards.length} total achievements
            </p>
          </div>
          
          {awards.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                No awards recorded yet
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {awards.map((award) => (
                <Card key={award.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{award.title}</h3>
                        {award.description && (
                          <p className="text-sm text-muted-foreground mb-2">{award.description}</p>
                        )}
                        {award.category && (
                          <Badge variant="secondary" className="mb-2">{award.category}</Badge>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(award.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="py-8 text-center text-muted-foreground">
              Activity tracking coming soon
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {incidents.length} total incident reports
            </p>
          </div>

          {incidents.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                No incident reports recorded
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {incidents.map((report) => (
                <Card key={report.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${
                        report.severity === "high" ? "bg-destructive/10" :
                        report.severity === "medium" ? "bg-warning/10" :
                        "bg-muted"
                      }`}>
                        <AlertTriangle className={`h-6 w-6 ${
                          report.severity === "high" ? "text-destructive" :
                          report.severity === "medium" ? "text-warning" :
                          "text-muted-foreground"
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-lg mb-1">{report.type}</h3>
                            {report.reported_by && (
                              <p className="text-sm text-muted-foreground">Reported by {report.reported_by}</p>
                            )}
                          </div>
                          <Badge variant="outline" className={
                            report.severity === "high" ? "bg-destructive/10 text-destructive border-destructive/20" :
                            report.severity === "medium" ? "bg-warning/10 text-warning border-warning/20" :
                            "bg-muted"
                          }>
                            {report.severity || "low"}
                          </Badge>
                        </div>
                        <p className="text-sm mb-3">{report.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(report.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <EditChildDialog
        childId={id || ""}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchChildData}
      />
    </div>
  );
}
