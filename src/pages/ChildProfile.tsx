import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Trophy, Star, Calendar, AlertTriangle, FileText, Pencil, Users, MapPin, Shield } from "lucide-react";
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
import { useCompany } from "@/contexts/CompanyContext";
import CamperReportsTab from "@/components/CamperReportsTab";
import ConflictIndicator from "@/components/ConflictIndicator";
import { usePermissions } from "@/hooks/usePermissions";

export default function ChildProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { getDivisionFilter, canSeeDivision, loading: permissionsLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [child, setChild] = useState<any>(null);
  const [awards, setAwards] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [sportsRoster, setSportsRoster] = useState<any[]>([]);
  const [tripAttendance, setTripAttendance] = useState<any[]>([]);
  const [sportsAcademy, setSportsAcademy] = useState<any[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [allergyText, setAllergyText] = useState("");
  const [savingAllergies, setSavingAllergies] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    if (id && !permissionsLoading) {
      fetchChildData();
    }
  }, [id, permissionsLoading]);

  const fetchChildData = async () => {
    try {
      // Fetch child details
      const { data: childData, error: childError } = await supabase
        .from("children")
        .select("*")
        .eq("id", id)
        .single();

      if (childError) throw childError;
      
      // Check if user has access to this child's division
      const divisionFilter = getDivisionFilter();
      if (divisionFilter !== null && childData?.division_id) {
        if (!divisionFilter.includes(childData.division_id)) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }
      
      setChild(childData);
      setAllergyText(childData?.allergies || "");

      // Fetch awards for this child - including historical awards from previous seasons
      let awardsData: any[] = [];
      
      if (childData?.person_id) {
        // Get all child records with the same person_id (across all seasons)
        const { data: allChildRecords } = await supabase
          .from("children")
          .select("id")
          .eq("person_id", childData.person_id)
          .eq("company_id", currentCompany?.id || '');

        if (allChildRecords && allChildRecords.length > 0) {
          const childIds = allChildRecords.map(c => c.id);
          
          // Fetch awards for all child records (historical)
          const { data: historicalAwards } = await supabase
            .from("awards")
            .select("*")
            .in("child_id", childIds)
            .eq("company_id", currentCompany?.id || '')
            .order("date", { ascending: false });

          awardsData = historicalAwards || [];
        }
      } else {
        // Fallback: just fetch awards for current child_id
        const { data: currentAwards } = await supabase
          .from("awards")
          .select("*")
          .eq("child_id", id)
          .eq("company_id", currentCompany?.id || '')
          .order("date", { ascending: false });

        awardsData = currentAwards || [];
      }

      setAwards(awardsData);

      // Fetch incident reports for this child through incident_children junction table
      const { data: incidentLinks } = await supabase
        .from("incident_children")
        .select(`
          incident_reports (
            id,
            date,
            type,
            severity,
            description,
            status,
            reported_by,
            tags,
            season,
            created_at
          )
        `)
        .eq("child_id", id);

      // Flatten the nested structure and sort by date
      const flattenedIncidents = incidentLinks
        ?.map(link => link.incident_reports)
        .filter(Boolean)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

      setIncidents(flattenedIncidents);

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
        .eq("child_id", id)
        .eq("company_id", currentCompany?.id || '');

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
        .eq("child_id", id)
        .eq("company_id", currentCompany?.id || '');

      setTripAttendance(tripData || []);

      // Fetch sports academy enrollments
      const { data: academyData } = await supabase
        .from("sports_academy")
        .select("*")
        .eq("child_id", id)
        .eq("company_id", currentCompany?.id || '')
        .order("sport_name", { ascending: true });

      setSportsAcademy(academyData || []);

      // Fetch unresolved conflicts
      const { data: conflictsData } = await supabase
        .from("schedule_conflicts")
        .select("*")
        .eq("entity_id", id)
        .eq("entity_type", "child")
        .eq("resolved", false)
        .eq("company_id", currentCompany?.id || '');

      setConflicts(conflictsData || []);
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

  if (loading || permissionsLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to view this camper's profile.</p>
        <Button onClick={() => navigate("/roster")} className="mt-4">
          Back to Campers
        </Button>
      </div>
    );
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
          {conflicts.length > 0 && (
            <ConflictIndicator count={conflicts.length} />
          )}
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
          {currentCompany?.slug === 'timber-lake-camp' && (
            <>
              <TabsTrigger value="10-day-report">10-Day Report</TabsTrigger>
              <TabsTrigger value="end-of-summer">End of Summer Report</TabsTrigger>
            </>
          )}
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
          <Tabs defaultValue="info" className="space-y-4">
            <TabsList>
              <TabsTrigger value="info">Birthday Info</TabsTrigger>
              <TabsTrigger value="party">Party Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
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

            <TabsContent value="party">
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Birthday Party Preferences</CardTitle>
                      <CardDescription>Celebration and cake customization details</CardDescription>
                    </div>
                    <Button onClick={() => setEditDialogOpen(true)} size="sm">
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {child.birthday_party_type || child.birthday_cake_meal ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        {child.birthday_party_type && (
                          <div className="p-4 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground mb-2">Party Type</p>
                            <Badge variant="secondary" className="text-sm">
                              {child.birthday_party_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </Badge>
                          </div>
                        )}
                        {child.birthday_cake_meal && (
                          <div className="p-4 rounded-lg bg-muted/50">
                            <p className="text-sm text-muted-foreground mb-2">Cake Served At</p>
                            <Badge variant="outline" className="text-sm capitalize">
                              {child.birthday_cake_meal}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {child.birthday_party_comments && (
                        <div className="p-4 rounded-lg bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-2">Special Requests</p>
                          <p className="text-sm">{child.birthday_party_comments}</p>
                        </div>
                      )}

                      {(child.birthday_cake_type || child.birthday_frosting_colors?.length > 0 || child.birthday_toppings?.length > 0 || child.birthday_cake_allergies?.length > 0 || child.birthday_cake_message) && (
                        <div className="border-t pt-4 space-y-4">
                          <h4 className="font-semibold">Cake Details</h4>
                          
                          {child.birthday_cake_type && (
                            <div className="p-4 rounded-lg bg-muted/50">
                              <p className="text-sm text-muted-foreground mb-2">Cake Type</p>
                              <p className="font-medium">
                                {child.birthday_cake_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </p>
                            </div>
                          )}

                          {child.birthday_frosting_colors && child.birthday_frosting_colors.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Frosting Colors</p>
                              <div className="flex flex-wrap gap-2">
                                {child.birthday_frosting_colors.map((color: string) => (
                                  <Badge key={color} variant="secondary" className="capitalize">
                                    {color.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {child.birthday_toppings && child.birthday_toppings.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Toppings</p>
                              <div className="flex flex-wrap gap-2">
                                {child.birthday_toppings.map((topping: string) => (
                                  <Badge key={topping} variant="outline" className="capitalize">
                                    {topping.replace(/_/g, ' ')}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {child.birthday_cake_allergies && child.birthday_cake_allergies.length > 0 && (
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Allergies/Dietary Restrictions</p>
                              <div className="flex flex-wrap gap-2">
                                {child.birthday_cake_allergies.map((allergy: string) => (
                                  <Badge key={allergy} variant="destructive" className="capitalize">
                                    {allergy}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {child.birthday_cake_message && (
                            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                              <p className="text-sm text-muted-foreground mb-2">Cake Message</p>
                              <p className="text-lg italic font-medium">"{child.birthday_cake_message}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No party preferences set</p>
                      <p className="text-sm mt-1">Click "Edit" to add birthday party details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
                          <div className="flex gap-2">
                            <Badge variant="outline" className={
                              report.severity === "high" ? "bg-destructive/10 text-destructive border-destructive/20" :
                              report.severity === "medium" ? "bg-warning/10 text-warning border-warning/20" :
                              "bg-muted"
                            }>
                              {report.severity || "low"}
                            </Badge>
                            {report.status && (
                              <Badge variant={
                                report.status === "resolved" ? "default" :
                                report.status === "open" ? "destructive" :
                                "secondary"
                              }>
                                {report.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm mb-3">{report.description}</p>
                        {report.tags && report.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {report.tags.map((tag: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
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

        {currentCompany?.slug === 'timber-lake-camp' && (
          <>
            <TabsContent value="10-day-report">
              <CamperReportsTab childId={id || ''} reportType="10_day" />
            </TabsContent>
            <TabsContent value="end-of-summer">
              <CamperReportsTab childId={id || ''} reportType="end_of_summer" />
            </TabsContent>
          </>
        )}
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
