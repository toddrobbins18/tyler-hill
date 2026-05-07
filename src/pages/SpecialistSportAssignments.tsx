import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";

function normalizeStaffEmail(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  return t || null;
}

const AVAILABLE_SPORTS = [
  "Baseball",
  "Basketball",
  "Dance",
  "Football",
  "Golf",
  "Gymnastics",
  "Hockey",
  "Lacrosse",
  "Soccer",
  "Softball",
  "Tennis",
  "Volleyball",
  "Waterfront"
];

export default function SpecialistSportAssignments() {
  const { currentCompany, isSuperAdmin } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchData();
    }
  }, [currentCompany?.id, currentSeason]);

  const fetchData = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    try {
      // 1) Users with app role `specialist`
      const { data: specialistRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('role', 'specialist')
        .eq('company_id', currentCompany.id);

      if (rolesError) {
        console.error('Error fetching specialists:', rolesError);
        toast.error("Failed to load specialists");
        return;
      }

      // 2) Staff directory: staff_type specialist / both (same season as roster) — matched to logins by email
      const { data: staffSpecialists, error: staffSpecError } = await supabase
        .from('staff')
        .select('email')
        .eq('company_id', currentCompany.id)
        .eq('status', 'active')
        .eq('season', currentSeason)
        .in('staff_type', ['specialist', 'both']);

      if (staffSpecError) {
        console.error('Error fetching specialist staff:', staffSpecError);
      }

      const staffEmails = new Set<string>();
      (staffSpecialists || []).forEach((row: { email?: string | null }) => {
        const n = normalizeStaffEmail(row.email);
        if (n) staffEmails.add(n);
      });

      let emailToProfile = new Map<string, { id: string; full_name: string | null; email: string | null }>();
      if (staffEmails.size > 0) {
        const { data: companyProfiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('company_id', currentCompany.id);
        if (profErr) console.error('Error fetching profiles for specialist staff:', profErr);
        (companyProfiles || []).forEach((p: any) => {
          const key = normalizeStaffEmail(p.email);
          if (key && staffEmails.has(key)) {
            emailToProfile.set(key, p);
          }
        });
      }

      const byUserId = new Map<string, { user_id: string; profiles: { id: string; full_name: string | null; email: string | null } }>();
      for (const row of specialistRoles || []) {
        if (row?.user_id && row?.profiles) {
          byUserId.set(row.user_id, { user_id: row.user_id, profiles: row.profiles });
        }
      }
      for (const email of staffEmails) {
        const p = emailToProfile.get(email);
        if (p?.id && !byUserId.has(p.id)) {
          byUserId.set(p.id, { user_id: p.id, profiles: p });
        }
      }

      const mergedSpecialists = Array.from(byUserId.values()).sort((a, b) =>
        (a.profiles.full_name || a.profiles.email || '').localeCompare(
          b.profiles.full_name || b.profiles.email || '',
          undefined,
          { sensitivity: 'base' }
        )
      );

      // Get all sport assignments for this company
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('specialist_sport_assignments')
        .select('user_id, sport')
        .eq('company_id', currentCompany.id);

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError);
        toast.error("Failed to load sport assignments");
        return;
      }

      // Build assignments map: { userId: ['Baseball', 'Soccer'] }
      const assignmentsMap: Record<string, string[]> = {};
      assignmentsData?.forEach((a: any) => {
        if (!assignmentsMap[a.user_id]) {
          assignmentsMap[a.user_id] = [];
        }
        assignmentsMap[a.user_id].push(a.sport);
      });

      setSpecialists(mergedSpecialists);
      setAssignments(assignmentsMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const toggleSportAssignment = async (userId: string, sport: string, isAssigned: boolean) => {
    if (!currentCompany?.id) return;

    try {
      if (isAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('specialist_sport_assignments')
          .delete()
          .eq('user_id', userId)
          .eq('sport', sport)
          .eq('company_id', currentCompany.id);

        if (error) throw error;
        toast.success(`Removed ${sport} assignment`);
      } else {
        // Add assignment
        const { error } = await supabase
          .from('specialist_sport_assignments')
          .insert({
            user_id: userId,
            sport: sport,
            company_id: currentCompany.id
          });

        if (error) throw error;
        toast.success(`Added ${sport} assignment`);
      }

      fetchData();
    } catch (error: any) {
      console.error('Error toggling assignment:', error);
      toast.error(error.message || "Failed to update assignment");
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Specialist Sport Assignments</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Specialist Sport Assignments</h1>
        <p className="text-muted-foreground">
          Assign which sports each specialist is responsible for. Specialists will receive email notifications only for their assigned sports.
          Staff marked as Specialist (Staff Type on their profile) appear here once their roster email matches their login profile for this camp and season.
        </p>
      </div>

      {isSuperAdmin && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You are viewing assignments for <strong>{currentCompany?.name}</strong>. Switch companies to manage other organizations.
          </AlertDescription>
        </Alert>
      )}

      {specialists.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No specialists found for this camp and season. Add people with Staff Type &quot;specialist&quot; or &quot;both&quot; (with their login email matching their staff profile), or assign the Specialist app role under user management—then they appear here so you can assign sports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {specialists.map((specialist: any) => {
            const profile = specialist.profiles;
            if (!profile) return null;

            return (
              <Card key={specialist.user_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{profile.full_name}</CardTitle>
                      <CardDescription>{profile.email}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          for (const sport of AVAILABLE_SPORTS) {
                            if (!assignments[specialist.user_id]?.includes(sport)) {
                              await toggleSportAssignment(specialist.user_id, sport, false);
                            }
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Select All
                      </button>
                      <button
                        onClick={async () => {
                          for (const sport of AVAILABLE_SPORTS) {
                            if (assignments[specialist.user_id]?.includes(sport)) {
                              await toggleSportAssignment(specialist.user_id, sport, true);
                            }
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {AVAILABLE_SPORTS.map(sport => {
                      const isAssigned = assignments[specialist.user_id]?.includes(sport) ?? false;
                      return (
                        <div 
                          key={sport} 
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <Label htmlFor={`${specialist.user_id}-${sport}`} className="cursor-pointer flex-1">
                            {sport}
                          </Label>
                          <Switch
                            id={`${specialist.user_id}-${sport}`}
                            checked={isAssigned}
                            onCheckedChange={() => toggleSportAssignment(specialist.user_id, sport, isAssigned)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
