import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, UserCog, Eye, Trophy, Users, Trash2 } from "lucide-react";
import AddUserDialog from "./AddUserDialog";

type UserRole = "super_admin" | "admin" | "staff" | "viewer" | "division_leader" | "specialist";

interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

export default function UserRoleManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name");

    if (profiles) {
      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          // Fetch ALL roles for this user
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          // Determine highest priority role
          const roles = rolesData?.map(r => r.role) || [];
          let displayRole: UserRole = "viewer";

          if (roles.includes("super_admin")) displayRole = "super_admin";
          else if (roles.includes("admin")) displayRole = "admin";
          else if (roles.includes("division_leader")) displayRole = "division_leader";
          else if (roles.includes("staff")) displayRole = "staff";
          else if (roles.includes("specialist")) displayRole = "specialist";

          return {
            ...profile,
            role: displayRole,
            full_name: profile.full_name || profile.email?.split('@')[0] || 'Unknown'
          };
        })
      );

      setUsers(usersWithRoles);
    }
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    // Delete existing role
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // Insert new role
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: newRole });

    if (error) {
      toast.error("Failed to update role");
      console.error(error);
    } else {
      toast.success("Role updated successfully");
      fetchUsers();
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      // Call edge function to delete auth user (will cascade to profile and user_roles)
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;

      toast.success(`User ${userEmail} deleted successfully`);
      fetchUsers();
    } catch (error) {
      toast.error("Failed to delete user");
      console.error(error);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "super_admin":
        return <Shield className="h-4 w-4" />;
      case "admin":
        return <Shield className="h-4 w-4" />;
      case "staff":
        return <Users className="h-4 w-4" />;
      case "division_leader":
        return <UserCog className="h-4 w-4" />;
      case "specialist":
        return <Trophy className="h-4 w-4" />;
      case "viewer":
        return <Eye className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "super_admin":
        return "destructive";
      case "admin":
        return "destructive";
      case "staff":
        return "default";
      case "division_leader":
        return "secondary";
      case "specialist":
        return "outline";
      case "viewer":
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Roles</CardTitle>
            <CardDescription>Manage user permissions and access levels</CardDescription>
          </div>
          <AddUserDialog onUserAdded={fetchUsers} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
            >
              <div className="space-y-1">
                <p className="font-medium">{user.full_name || "No name"}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={getRoleBadgeVariant(user.role)} className="gap-1">
                  {getRoleIcon(user.role)}
                  {user.role === 'super_admin' ? 'Super Admin' :
                   user.role === 'division_leader' ? 'Division Leader' : 
                   user.role === 'specialist' ? 'Specialist' : 
                   user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
                <Select
                  value={user.role}
                  onValueChange={(value) => updateUserRole(user.id, value as UserRole)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="division_leader">Division Leader</SelectItem>
                    <SelectItem value="specialist">Specialist</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete User</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {user.full_name || user.email}? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteUser(user.id, user.email)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
