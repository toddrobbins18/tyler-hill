import { useState, useEffect } from "react";
import { Shield, Users, Database, FileText, Tag, Mail, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import UserRoleManagement from "@/components/admin/UserRoleManagement";
import DataManagement from "@/components/admin/DataManagement";
import AuditLog from "@/components/admin/AuditLog";
import UserTagManagement from "@/components/admin/UserTagManagement";
import AutomatedEmailConfig from "@/components/admin/AutomatedEmailConfig";
import CompanyManagement from "@/pages/admin/CompanyManagement";

export default function Admin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isSuperAdmin } = usePermissions();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!roles);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, roles, and system settings</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-2">
            <Tag className="h-4 w-4" />
            User Tags
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Automation
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
          )}
          <TabsTrigger value="data" className="gap-2">
            <Database className="h-4 w-4" />
            Data Management
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <FileText className="h-4 w-4" />
            Edit History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <UserRoleManagement />
        </TabsContent>

        <TabsContent value="tags" className="space-y-6">
          <UserTagManagement />
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <AutomatedEmailConfig />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="companies" className="space-y-6">
            <CompanyManagement />
          </TabsContent>
        )}

        <TabsContent value="data" className="space-y-6">
          <DataManagement />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <AuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
