import { Shield, Users, Database, FileText, Tag, Mail, Building2, Upload, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import UserRoleManagement from "@/components/admin/UserRoleManagement";
import DataManagement from "@/components/admin/DataManagement";
import AuditLog from "@/components/admin/AuditLog";
import UserTagManagement from "@/components/admin/UserTagManagement";
import AutomatedEmailConfig from "@/components/admin/AutomatedEmailConfig";
import CompanyEmailConfig from "@/components/admin/CompanyEmailConfig";
import CompanyManagement from "@/pages/admin/CompanyManagement";
import CampDataImporter from "@/components/admin/CampDataImporter";
import DataExporter from "@/components/admin/DataExporter";

export default function Admin() {
  const { isSuperAdmin } = usePermissions();
  const { currentCompany } = useCompany();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, roles, and system settings</p>
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
              <p className="text-xs text-muted-foreground mt-1">
                You have full administrative access across all companies
              </p>
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-9' : 'grid-cols-6'} lg:w-auto`}>
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
            <TabsTrigger value="email-config" className="gap-2">
              <Mail className="h-4 w-4" />
              Email Config
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="h-4 w-4" />
              Companies
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="data" className="gap-2">
              <Database className="h-4 w-4" />
              Data Management
            </TabsTrigger>
          )}
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Data Import
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            Data Export
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
          <TabsContent value="email-config" className="space-y-6">
            <CompanyEmailConfig />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="companies" className="space-y-6">
            <CompanyManagement />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="data" className="space-y-6">
            <DataManagement />
          </TabsContent>
        )}

        <TabsContent value="import" className="space-y-6">
          <CampDataImporter />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <DataExporter />
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <AuditLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}
