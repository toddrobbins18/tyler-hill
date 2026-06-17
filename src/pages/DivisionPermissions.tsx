import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { Users, Shield, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";
import { getDivisionDropdownLabel } from "@/lib/divisionFilterUtils";

const DIVISION_SCOPED_ROLES = new Set(["division_leader", "viewer"]);

function roleLabel(role: string) {
  if (role === "division_leader") return "Division Leader";
  if (role === "specialist") return "Specialist";
  return role;
}

export default function DivisionPermissions() {
  const [divisions, setDivisions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { isSuperAdmin } = usePermissions();
  const skipRealtimeRefetchRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentCompany?.id) return;

    const companyId = currentCompany.id;

    const [{ data: divisionsData }, { data: usersData }, { data: rolesData }, { data: permsData, error }] =
      await Promise.all([
        supabase
          .from("divisions")
          .select("id, name, gender, sort_order")
          .eq("company_id", companyId)
          .eq("is_active", true),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("approved", true)
          .eq("company_id", companyId)
          .order("full_name"),
        supabase.from("user_roles").select("user_id, role").eq("company_id", companyId),
        supabase.from("division_permissions").select("user_id, division_id, can_access").eq("company_id", companyId),
      ]);

    if (error) {
      toast({ title: "Error fetching permissions", variant: "destructive" });
      setLoading(false);
      return;
    }

    const permissionMap: Record<string, Record<string, boolean>> = {};
    permsData?.forEach((perm) => {
      if (!perm.can_access) return;
      if (!permissionMap[perm.user_id]) {
        permissionMap[perm.user_id] = {};
      }
      permissionMap[perm.user_id][perm.division_id] = true;
    });

    const rolesMap: Record<string, string> = {};
    rolesData?.forEach((roleEntry) => {
      rolesMap[roleEntry.user_id] = roleEntry.role;
    });

    const usersWithRoles = (usersData || []).map((user) => ({
      ...user,
      role: rolesMap[user.id] || "viewer",
    }));

    setDivisions(sortDivisionsAlternatingGender(divisionsData || []));
    setUsers(usersWithRoles);
    setPermissions(permissionMap);
    setLoading(false);
  }, [currentCompany?.id, toast]);

  const scheduleRefetch = useCallback(() => {
    if (skipRealtimeRefetchRef.current) return;
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      fetchData();
    }, 800);
  }, [fetchData]);

  useEffect(() => {
    if (!currentCompany?.id) return;

    setLoading(true);
    fetchData();

    const channel = supabase
      .channel("division-permissions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "division_permissions" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, fetchData, scheduleRefetch]);

  const persistPermissions = useCallback(
    async (userId: string, nextForUser: Record<string, boolean>) => {
      if (!currentCompany?.id) return false;

      const rows = divisions.map((division) => ({
        user_id: userId,
        division_id: division.id,
        can_access: nextForUser[division.id] ?? false,
        company_id: currentCompany.id,
      }));

      skipRealtimeRefetchRef.current = true;
      const { error } = await supabase.from("division_permissions").upsert(rows, {
        onConflict: "user_id,division_id",
      });
      skipRealtimeRefetchRef.current = false;

      if (error) {
        console.error("Division permission update failed:", error);
        toast({
          title: "Error updating permissions",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      return true;
    },
    [currentCompany?.id, divisions, toast],
  );

  const setUserPermissions = useCallback(
    async (userId: string, grant: boolean) => {
      if (divisions.length === 0 || busyUserId) return;

      const previous = permissions[userId] || {};
      const nextForUser = Object.fromEntries(divisions.map((division) => [division.id, grant]));

      setBusyUserId(userId);
      setPermissions((prev) => ({ ...prev, [userId]: nextForUser }));

      const ok = await persistPermissions(userId, nextForUser);
      setBusyUserId(null);

      if (!ok) {
        setPermissions((prev) => ({ ...prev, [userId]: previous }));
        return;
      }

      toast({ title: grant ? "All divisions selected" : "All divisions cleared" });
    },
    [busyUserId, divisions, permissions, persistPermissions, toast],
  );

  const togglePermission = useCallback(
    async (userId: string, divisionId: string, currentValue: boolean) => {
      if (busyUserId) return;

      const newValue = !currentValue;
      const previous = permissions[userId] || {};

      setPermissions((prev) => ({
        ...prev,
        [userId]: {
          ...prev[userId],
          [divisionId]: newValue,
        },
      }));

      skipRealtimeRefetchRef.current = true;
      const { error } = await supabase.from("division_permissions").upsert(
        {
          user_id: userId,
          division_id: divisionId,
          can_access: newValue,
          company_id: currentCompany!.id,
        },
        { onConflict: "user_id,division_id" },
      );
      skipRealtimeRefetchRef.current = false;

      if (error) {
        console.error("Division permission toggle failed:", error);
        setPermissions((prev) => ({
          ...prev,
          [userId]: previous,
        }));
        toast({
          title: "Error updating permission",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [busyUserId, currentCompany?.id, permissions, toast],
  );

  const scopedUsers = useMemo(
    () => users.filter((user) => DIVISION_SCOPED_ROLES.has(user.role)),
    [users],
  );

  const otherUsers = useMemo(
    () => users.filter((user) => !DIVISION_SCOPED_ROLES.has(user.role)),
    [users],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Division Permissions</h1>
        <p className="text-muted-foreground">Control which divisions each user can access</p>
      </div>

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
                    <span>
                      Viewing: <strong className="text-foreground">{currentCompany.name}</strong>
                    </span>
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
          {scopedUsers.map((user) => {
            const isBusy = busyUserId === user.id;
            const selectedCount = divisions.filter(
              (division) => permissions[user.id]?.[division.id],
            ).length;

            return (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Shield className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="min-w-0">
                        <CardTitle>{user.full_name || user.email}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {roleLabel(user.role)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {selectedCount}/{divisions.length} selected
                      </span>
                      <Button
                        size="sm"
                        disabled={isBusy || selectedCount === divisions.length}
                        onClick={() => setUserPermissions(user.id, true)}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy || selectedCount === 0}
                        onClick={() => setUserPermissions(user.id, false)}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {divisions.map((division) => {
                      const hasAccess = permissions[user.id]?.[division.id] ?? false;
                      return (
                        <div
                          key={division.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <Label
                            htmlFor={`${user.id}-${division.id}`}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Users className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{getDivisionDropdownLabel(division.name)}</span>
                          </Label>
                          <Switch
                            id={`${user.id}-${division.id}`}
                            checked={hasAccess}
                            disabled={isBusy}
                            onCheckedChange={() => togglePermission(user.id, division.id, hasAccess)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {otherUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Other roles</CardTitle>
                <CardDescription>
                  Admins, staff, specialists, and health center users already have access to all
                  divisions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {otherUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{user.full_name || user.email}</span>
                    <Badge variant="outline">{roleLabel(user.role)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!loading && scopedUsers.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              No division leaders or viewers found for this camp.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
