import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { Shield, Users, Eye, UserCog, Trophy, Building2, Heart } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isTimberLakeWestCompany, isTylerHillCamp, shouldShowTigerTimes } from "@/lib/camps";

type MenuCompany = { slug?: string; name?: string } | null | undefined;

const getCompanyMenuItems = (company?: MenuCompany) => {
  const companySlug = company?.slug;
  const isWest = isTimberLakeWestCompany(company);
  const isCamp = shouldShowTigerTimes(company);
  // NOTE: These IDs MUST match the permission keys used by AppSidebar + ProtectedRoute.
  // If they drift, toggling permissions here won't affect what users can actually access.
  // This mirrors AppSidebar.tsx getMenuItems() exactly.
  const baseItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "roster", label: "Camper", icon: "👥" },
    { id: "staff", label: "Staff", icon: "👤" },
    { id: "messages", label: "Messages", icon: "💬" },
    { id: "activities", label: "Activities & Field Trips", icon: "🌴" },
    { id: "calendar", label: "Master Calendar", icon: "📅" },
    { id: "menu", label: "Menu", icon: "🍽️" },
    { id: "rainy-day", label: "Rainy Day Schedule", icon: "🌧️" },
    { id: "special-events", label: isWest ? "Special Events" : "Special Events & Evening Activities", icon: "🎉" },
    { id: "transportation", label: "Transportation", icon: "🚌" },
    { id: "tutoring-therapy", label: "Tutoring & Therapy", icon: "📖" },
    { id: "od-management", label: "OD Management", icon: "✅" },
    { id: "appointments", label: "Appointments", icon: "🩺" },
    { id: "reports", label: "Reports", icon: "📈" },
    { id: "nurse", label: "Nurse", icon: "💊" },
    { id: "awards", label: "Awards", icon: "🏆" },
    { id: "incidents", label: "Incident Reports", icon: "⚠️" },
    { id: "sports-academy", label: "Sports Academy", icon: "⚽" },
    { id: "roster-templates", label: "Roster Templates", icon: "🗂️" },
    { id: "sports-calendar", label: isWest ? "Athletics" : "Sports Calendar", icon: "🏅" },
    { id: "special-meals", label: "Special Meals", icon: "🍽️" },
  ];

  baseItems.push({
    id: "notes",
    label: isTylerHillCamp(companySlug) ? "Daily News" : "Daily Notes",
    icon: "📝",
  });

  // Daily Wolf - ONLY for timber-lake-west (matches AppSidebar)
  if (isWest) {
    baseItems.push(
      { id: "daily-wolf-printable", label: "Daily Wolf Printable", icon: "📰" },
      { id: "daily-wolf-management", label: "Daily Wolf Management", icon: "✏️" }
    );
  }

  // Tiger Times - ONLY for timber-lake-camp (matches AppSidebar)
  if (isCamp) {
    baseItems.push(
      { id: "daily-wolf-management", label: "Tiger Times", icon: "🐯" }
    );
  }

  // Daily Schedule - ONLY for timber-lake-camp (matches AppSidebar)
  if (isCamp) {
    baseItems.push(
      { id: "daily-schedule", label: "Daily Schedule", icon: "📅" },
      { id: "elective-signup", label: "Elective Sign-Up", icon: "🔗" }
    );
  }

  if (isTylerHillCamp(companySlug)) {
    baseItems.push({ id: "owl-pay", label: "Owl Pay", icon: "🦉" });
  }

  // Admin items (all companies)
  baseItems.push(
    { id: "admin", label: "Admin Panel", icon: "⚙️" },
    { id: "evaluation-questions", label: "Evaluation Questions", icon: "📋" },
    { id: "role-permissions", label: "Role Permissions", icon: "🔒" },
    { id: "division-permissions", label: "Division Permissions", icon: "🔐" },
    { id: "specialist-sport-assignments", label: "Specialist Sport Assignments", icon: "🏅" },
    { id: "user-approvals", label: "User Approvals", icon: "✅" }
  );

  return baseItems.sort((a, b) => a.label.localeCompare(b.label));
};

const roles = [
  { id: "admin", label: "Administrator", icon: Shield, description: "Full system access" },
  { id: "staff", label: "Staff", icon: Users, description: "Standard staff access" },
  { id: "division_leader", label: "Division Leader", icon: UserCog, description: "Full access to assigned division(s)" },
  { id: "specialist", label: "Specialist", icon: Trophy, description: "Cross-division access to specialized features (e.g., sports)" },
  { id: "health_center", label: "Health Center", icon: Heart, description: "Access to health, medical, and incident reports" },
  { id: "viewer", label: "Viewer", icon: Eye, description: "Read-only access" },
];

export default function RolePermissions() {
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<Array<{ id: string; label: string; icon: string }>>([]);
  const { toast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const { currentCompany } = useCompany();

  useEffect(() => {
    if (currentCompany) {
      setMenuItems(getCompanyMenuItems(currentCompany));
      fetchPermissions();
    }

    const channel = supabase
      .channel('role-permissions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, fetchPermissions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany]);

  const fetchPermissions = async () => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("company_id", currentCompany!.id);

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
    const { error } = await supabase.rpc('can_access_page', {
      _user_id: (await supabase.auth.getUser()).data.user?.id,
      _page_name: 'role-permissions'
    });

    const { error: updateError } = await supabase
      .from("role_permissions")
      .upsert({
        role: role as any,
        menu_item: menuItem,
        can_access: !currentValue,
        company_id: currentCompany!.id
      }, {
        // Must match DB unique constraint: (company_id, role, menu_item)
        onConflict: 'company_id,role,menu_item'
      });

    if (updateError) {
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

      {/* Super Admin Status Banner */}
      {isSuperAdmin && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="bg-primary">
                  Super Admin
                </Badge>
                {currentCompany && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <span>Viewing: <strong className="text-foreground">{currentCompany.name}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

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
                    <div className="flex-1">
                      <CardTitle>{role.label}</CardTitle>
                      <CardDescription>{role.description}</CardDescription>
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={async () => {
                          for (const item of menuItems) {
                            if (!permissions[role.id]?.[item.id]) {
                              await togglePermission(role.id, item.id, false);
                            }
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Select All
                      </button>
                      <button
                        onClick={async () => {
                          for (const item of menuItems) {
                            if (permissions[role.id]?.[item.id]) {
                              await togglePermission(role.id, item.id, true);
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
