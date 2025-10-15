import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function DivisionPermissions() {
  const [divisions, setDivisions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('division-permissions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'division_permissions' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    // Fetch divisions
    const { data: divisionsData } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");

    // Fetch users (profiles)
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("approved", true)
      .order("full_name");

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

    setDivisions(divisionsData || []);
    setUsers(usersData || []);
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
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>{user.full_name || user.email}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
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