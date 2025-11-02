import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/contexts/CompanyContext";

export default function DivisionPermissions() {
  const [divisions, setDivisions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  useEffect(() => {
    if (currentCompany?.id) {
      fetchData();
    }

    const channel = supabase
      .channel('division-permissions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'division_permissions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id]);

  const fetchData = async () => {
    // Fetch divisions
    const { data: divisionsData } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");

    // Fetch approved users
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("approved", true)
      .eq("company_id", currentCompany?.id)
      .order("full_name");

    if (!usersData) {
      setLoading(false);
      return;
    }

    // Fetch roles for all users
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", usersData.map(u => u.id));

    // Fetch division permissions
    const { data: permsData, error } = await supabase
      .from("division_permissions")
      .select("*");

    if (error) {
      toast({ title: "Error fetching permissions", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Build permissions map
    const permissionMap: Record<string, Record<string, boolean>> = {};
    permsData?.forEach((perm) => {
      if (!permissionMap[perm.user_id]) {
        permissionMap[perm.user_id] = {};
      }
      permissionMap[perm.user_id][perm.division_id] = perm.can_access;
    });

    // Build roles map
    const rolesMap: Record<string, string> = {};
    rolesData?.forEach((roleEntry) => {
      rolesMap[roleEntry.user_id] = roleEntry.role;
    });

    // Transform users data to include role
    const usersWithRoles = usersData.map(user => ({
      ...user,
      role: rolesMap[user.id] || 'viewer'
    }));

    setDivisions(divisionsData || []);
    setUsers(usersWithRoles);
    setPermissions(permissionMap);
    setLoading(false);
  };

  const togglePermission = async (userId: string, divisionId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from("division_permissions")
      .upsert({
        user_id: userId,
        division_id: divisionId,
        can_access: !currentValue,
      }, {
        onConflict: 'user_id,division_id'
      });

    if (error) {
      toast({ title: "Error updating permission", variant: "destructive" });
      return;
    }

    toast({ title: "Permission updated successfully" });
    fetchData();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Division Permissions</h1>
        <p className="text-muted-foreground">Control which divisions each user can access</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading permissions...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {users.map((user: any) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <div className="flex items-center gap-2 flex-1">
                    <div>
                      <CardTitle>{user.full_name || user.email}</CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                    <Badge 
                      variant={
                        user.role === 'admin' ? 'default' : 
                        user.role === 'division_leader' ? 'secondary' :
                        user.role === 'specialist' ? 'outline' : 
                        'secondary'
                      }
                      className="ml-2"
                    >
                      {user.role === 'division_leader' ? 'Division Leader' : 
                       user.role === 'specialist' ? 'Specialist' :
                       user.role}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {divisions.map((division) => {
                    const hasAccess = permissions[user.id]?.[division.id] ?? false;
                    return (
                      <div
                        key={division.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <Label htmlFor={`${user.id}-${division.id}`} className="flex items-center gap-2 cursor-pointer">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">{division.name}</span>
                        </Label>
                        <Switch
                          id={`${user.id}-${division.id}`}
                          checked={hasAccess}
                          onCheckedChange={() => togglePermission(user.id, division.id, hasAccess)}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && users.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No approved users found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}