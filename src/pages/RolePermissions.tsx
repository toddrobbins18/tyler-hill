import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Eye, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "roster", label: "Roster", icon: "👥" },
  { id: "staff", label: "Staff", icon: "👤" },
  { id: "notes", label: "Daily Notes", icon: "📝" },
  { id: "awards", label: "Awards", icon: "🏆" },
  { id: "transportation", label: "Transportation", icon: "🚌" },
  { id: "menu", label: "Menu", icon: "🍽️" },
  { id: "nurse", label: "Nurse Dashboard", icon: "💊" },
  { id: "messages", label: "Messages", icon: "💬" },
  { id: "admin", label: "Admin", icon: "⚙️" },
];

const roles = [
  { id: "admin", label: "Admin", icon: Shield, description: "Full access to all features" },
  { id: "staff", label: "Staff", icon: Users, description: "Access to day-to-day operations" },
  { id: "viewer", label: "Viewer", icon: Eye, description: "Read-only access" },
];

export default function RolePermissions() {
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();

    const channel = supabase
      .channel('role-permissions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, fetchPermissions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPermissions = async () => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("*");

    if (error) {
      toast({ title: "Error fetching permissions", variant: "destructive" });
      return;
    }

    const permissionMap: Record<string, Record<string, boolean>> = {};
    data?.forEach((perm) => {
      if (!permissionMap[perm.role]) {
        permissionMap[perm.role] = {};
      }
      permissionMap[perm.role][perm.menu_item] = perm.can_access;
    });

    setPermissions(permissionMap);
    setLoading(false);
  };

  const togglePermission = async (role: string, menuItem: string, currentValue: boolean) => {
    const { error } = await supabase
      .from("role_permissions")
      .upsert({
        role: role as any,
        menu_item: menuItem,
        can_access: !currentValue,
      }, {
        onConflict: 'role,menu_item'
      });

    if (error) {
      toast({ title: "Error updating permission", variant: "destructive" });
      return;
    }

    toast({ title: "Permission updated successfully" });
    fetchPermissions();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Role Permissions</h1>
        <p className="text-muted-foreground">Manage access permissions for different user roles</p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading permissions...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {roles.map((role) => {
            const RoleIcon = role.icon;
            return (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <RoleIcon className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>{role.label}</CardTitle>
                      <CardDescription>{role.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {menuItems.map((item) => {
                      const hasAccess = permissions[role.id]?.[item.id] ?? false;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <Label htmlFor={`${role.id}-${item.id}`} className="flex items-center gap-2 cursor-pointer">
                            <span>{item.icon}</span>
                            <span className="text-sm">{item.label}</span>
                          </Label>
                          <Switch
                            id={`${role.id}-${item.id}`}
                            checked={hasAccess}
                            onCheckedChange={() => togglePermission(role.id, item.id, hasAccess)}
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
