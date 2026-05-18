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
  const [staffSpecialists, setStaffSpecialists] = useState<any[]>([]);
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
        .select('user_id')
        .eq('role', 'specialist')
        .eq('company_id', currentCompany.id);

      if (rolesError) {
        console.error('Error fetching specialists:', rolesError);
        toast.error("Failed to load specialists");
      }

      // 2) Staff directory: staff_type specialist / both (same season as roster)
      const { data: staffSpecialistRows, error: staffSpecError } = await supabase
        .from('staff')
        .select('id, name, email, role, staff_type, specialty_sports')
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .neq('name', 'Unknown')
        .not('name', 'is', null)
        .in('staff_type', ['specialist', 'both']);

      if (staffSpecError) {
        console.error('Error fetching specialist staff:', staffSpecError);
      }

      const roleUserIds = new Set<string>();
      (specialistRoles || []).forEach((row: { user_id?: string | null }) => {
        if (row.user_id) roleUserIds.add(row.user_id);
      });

      const staffEmails = new Set<string>();
      (staffSpecialistRows || []).forEach((row: { email?: string | null }) => {
        const n = normalizeStaffEmail(row.email);
        if (n) staffEmails.add(n);
      });

      const emailToProfile = new Map<string, { id: string; full_name: string | null; email: string | null }>();
      const profileById = new Map<string, { id: string; full_name: string | null; email: string | null }>();
      if (staffEmails.size > 0 || roleUserIds.size > 0) {
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
          if (roleUserIds.has(p.id)) {
            profileById.set(p.id, p);
          }
        });
      }

      const byUserId = new Map<string, { user_id: string; profiles: { id: string; full_name: string | null; email: string | null } }>();
      for (const userId of roleUserIds) {
        const p = profileById.get(userId);
        if (p) {
          byUserId.set(userId, { user_id: userId, profiles: p });
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
      setStaffSpecialists(
        (staffSpecialistRows || []).sort((a: any, b: any) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        )
      );
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

  const toggleStaffSportAssignment = async (staffMember: any, sport: string, isAssigned: boolean) => {
    if (!currentCompany?.id) return;

    const currentSports = Array.isArray(staffMember.specialty_sports)
      ? staffMember.specialty_sports
      : [];
    const nextSports = isAssigned
      ? currentSports.filter((s: string) => s !== sport)
      : Array.from(new Set([...currentSports, sport]));

    const { error } = await supabase
      .from('staff')
      .update({ specialty_sports: nextSports })
      .eq('id', staffMember.id)
      .eq('company_id', currentCompany.id)
      .eq('season', currentSeason);

    if (error) {
      console.error('Error updating staff sports:', error);
      toast.error(error.message || "Failed to update staff sport assignments");
      return;
    }

    toast.success(`${isAssigned ? 'Removed' : 'Added'} ${sport} for ${staffMember.name}`);
    fetchData();
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
          Assign sports to specialist leaders with logins, then assign staff to the sports/departments where they should be evaluated.
          Staff do not need logins to appear in the staff assignment section.
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

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Specialist Leaders</h2>
          <p className="text-sm text-muted-foreground">
            These people have a login or Specialist app role. Their assigned sports determine which staff they can evaluate.
          </p>
        </div>

      {specialists.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No specialist leaders found for this camp and season. Add a login with the Specialist app role, or match a Specialist/Both staff profile to a login email.
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

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Staff Sport / Department Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Staff marked Specialist or Both appear here even without a login. Assign Tennis, Baseball, etc. so the matching specialist leader can evaluate them.
          </p>
        </div>

        {staffSpecialists.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No Specialist or Both staff found for this camp and season.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {staffSpecialists.map((staffMember: any) => {
              const selectedSports = Array.isArray(staffMember.specialty_sports)
                ? staffMember.specialty_sports
                : [];

              return (
                <Card key={staffMember.id}>
                  <CardHeader>
                    <div>
                      <CardTitle>{staffMember.name}</CardTitle>
                      <CardDescription>
                        {staffMember.role || "No role"}{staffMember.email ? ` • ${staffMember.email}` : " • No login required"}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {AVAILABLE_SPORTS.map(sport => {
                        const isAssigned = selectedSports.includes(sport);
                        return (
                          <div
                            key={sport}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                          >
                            <Label htmlFor={`${staffMember.id}-${sport}`} className="cursor-pointer flex-1">
                              {sport}
                            </Label>
                            <Switch
                              id={`${staffMember.id}-${sport}`}
                              checked={isAssigned}
                              onCheckedChange={() => toggleStaffSportAssignment(staffMember, sport, isAssigned)}
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
    </div>
  );
}
