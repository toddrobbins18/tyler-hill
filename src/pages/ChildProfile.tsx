import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Trophy, Star, Calendar, AlertTriangle, FileText, Pencil, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import EditChildDialog from "@/components/dialogs/EditChildDialog";
import { toast as sonnerToast } from "sonner";

export default function ChildProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [child, setChild] = useState<any>(null);
  const [awards, setAwards] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [sportsRoster, setSportsRoster] = useState<any[]>([]);
  const [tripAttendance, setTripAttendance] = useState<any[]>([]);
  const [sportsAcademy, setSportsAcademy] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [allergyText, setAllergyText] = useState("");
  const [savingAllergies, setSavingAllergies] = useState(false);

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
      setAllergyText(childData?.allergies || "");

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

      // Fetch sports roster assignments
      const { data: sportsData } = await supabase
        .from("sports_event_roster")
        .select(`
          *,
          sports_calendar (
            id,
            title,
            sport_type,
            event_date,
            time,
            location,
            team,
            opponent
          )
        `)
        .eq("child_id", id);

      setSportsRoster(sportsData || []);

      // Fetch trip attendance
      const { data: tripData } = await supabase
        .from("trip_attendees")
        .select(`
          *,
          trips (
            id,
            name,
            destination,
            date,
            type,
            departure_time,
            return_time
          )
        `)
        .eq("child_id", id);

      setTripAttendance(tripData || []);

      // Fetch sports academy enrollments
      const { data: academyData } = await supabase
        .from("sports_academy")
        .select("*")
        .eq("child_id", id)
        .order("sport_name", { ascending: true });

      setSportsAcademy(academyData || []);
    } catch (error) {
      console.error("Error fetching child data:", error);
      toast({ title: "Error loading child profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllergies = async () => {
    if (!id) return;
    
    setSavingAllergies(true);
    try {
      const { error } = await supabase
        .from("children")
        .update({ allergies: allergyText })
        .eq("id", id);

      if (error) throw error;

      sonnerToast.success("Allergies updated successfully");
      setChild((prev: any) => ({ ...prev, allergies: allergyText }));
    } catch (error: any) {
      console.error("Error updating allergies:", error);
      sonnerToast.error("Failed to update allergies");
    } finally {
      setSavingAllergies(false);
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
          <TabsTrigger value="birthday">Birthday</TabsTrigger>
          <TabsTrigger value="allergies">Allergies</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="sports-academy">Sports Academy</TabsTrigger>
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

        <TabsContent value="birthday" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Birthday Information</CardTitle>
              <CardDescription>Date of birth and age details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {child.date_of_birth ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Date of Birth</p>
                        <p className="text-2xl font-bold text-primary">
                          {new Date(child.date_of_birth).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                  {child.age && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Current Age</p>
                      <p className="text-xl font-semibold">{child.age} years old</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No birthday information available</p>
                  <p className="text-sm mt-1">Click "Edit Profile" to add date of birth</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allergies" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Allergy Information</CardTitle>
              <CardDescription>Manage allergy information for this child</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={allergyText}
                onChange={(e) => setAllergyText(e.target.value)}
                placeholder="Enter allergy information (e.g., peanuts, dairy, shellfish...)"
                rows={8}
                className="resize-none"
              />
              <Button 
                onClick={handleSaveAllergies} 
                disabled={savingAllergies}
              >
                {savingAllergies ? "Saving..." : "Save Allergies"}
              </Button>
            </CardContent>
          </Card>
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
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Sports Events
              </h3>
              {sportsRoster.length === 0 ? (
                <Card className="shadow-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Not assigned to any sports events
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {sportsRoster.map((roster: any) => (
                    <Card key={roster.id} className="shadow-card">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-primary/10">
                            <Trophy className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-lg mb-1">
                                  {roster.sports_calendar?.title}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {roster.sports_calendar?.sport_type}
                                  {roster.sports_calendar?.team && ` • ${roster.sports_calendar.team}`}
                                  {roster.sports_calendar?.opponent && ` vs ${roster.sports_calendar.opponent}`}
                                </p>
                              </div>
                              <Badge variant={roster.confirmed ? "default" : "outline"}>
                                {roster.confirmed ? "Confirmed" : "Pending"}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {roster.sports_calendar?.event_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{new Date(roster.sports_calendar.event_date).toLocaleDateString()}</span>
                                </div>
                              )}
                              {roster.sports_calendar?.time && (
                                <span>• {roster.sports_calendar.time}</span>
                              )}
                              {roster.sports_calendar?.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  <span>{roster.sports_calendar.location}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Field Trips
              </h3>
              {tripAttendance.length === 0 ? (
                <Card className="shadow-card">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Not assigned to any field trips
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {tripAttendance.map((attendance: any) => (
                    <Card key={attendance.id} className="shadow-card">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-secondary/10">
                            <Users className="h-6 w-6 text-secondary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-lg mb-1">
                                  {attendance.trips?.name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {attendance.trips?.type}
                                  {attendance.trips?.destination && ` • ${attendance.trips.destination}`}
                                </p>
                              </div>
                              <Badge variant={attendance.confirmed ? "default" : "outline"}>
                                {attendance.confirmed ? "Confirmed" : "Pending"}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {attendance.trips?.date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  <span>{new Date(attendance.trips.date).toLocaleDateString()}</span>
                                </div>
                              )}
                              {attendance.trips?.departure_time && (
                                <span>Depart: {attendance.trips.departure_time}</span>
                              )}
                              {attendance.trips?.return_time && (
                                <span>• Return: {attendance.trips.return_time}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sports-academy" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {sportsAcademy.length} total enrollments
            </p>
          </div>
          
          {sportsAcademy.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-8 text-center text-muted-foreground">
                No sports academy enrollments recorded
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sportsAcademy.map((enrollment) => (
                <Card key={enrollment.id} className="shadow-card">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Trophy className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{enrollment.sport_name}</h3>
                        {enrollment.instructor && (
                          <p className="text-sm text-muted-foreground mb-2">Instructor: {enrollment.instructor}</p>
                        )}
                        {enrollment.schedule_periods && enrollment.schedule_periods.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {enrollment.schedule_periods.map((period: string, idx: number) => (
                              <Badge key={idx} variant="secondary">{period}</Badge>
                            ))}
                          </div>
                        )}
                        {(enrollment.start_date || enrollment.end_date) && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {enrollment.start_date && new Date(enrollment.start_date).toLocaleDateString()}
                              {enrollment.end_date && ` - ${new Date(enrollment.end_date).toLocaleDateString()}`}
                            </span>
                          </div>
                        )}
                        {enrollment.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{enrollment.notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
