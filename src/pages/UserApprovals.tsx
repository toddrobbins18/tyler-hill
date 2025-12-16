import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { CheckCircle, XCircle, Clock, Shield, Building2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

export default function UserApprovals() {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const { currentCompany, availableCompanies } = useCompany();

  useEffect(() => {
    fetchPendingUsers();
    fetchCompanies();

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => fetchPendingUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, currentCompany?.id]);

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setCompanies(data);
    }
  };

  const fetchPendingUsers = async () => {
    let query = supabase
      .from("profiles")
      .select("*")
      .eq("approved", false)
      .order("approval_requested_at", { ascending: false });

    // Super admins see all pending users, regular admins only see their company's users
    if (!isSuperAdmin && currentCompany?.id) {
      query = query.eq("company_id", currentCompany.id);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error fetching pending users", variant: "destructive" });
      setLoading(false);
      return;
    }
    
    // Initialize selected companies with existing company_id values
    const initialSelections: Record<string, string> = {};
    data?.forEach(user => {
      if (user.company_id) {
        initialSelections[user.id] = user.company_id;
      }
    });
    setSelectedCompanies(prev => ({ ...prev, ...initialSelections }));
    
    setPendingUsers(data || []);
    setLoading(false);
  };

  const handleCompanySelect = (userId: string, companyId: string) => {
    setSelectedCompanies(prev => ({ ...prev, [userId]: companyId }));
  };

  const handleApprove = async (userId: string) => {
    const selectedCompanyId = selectedCompanies[userId];
    
    if (!selectedCompanyId) {
      toast({ title: "Please select a camp first", variant: "destructive" });
      return;
    }

    // Update profile with approved status and company_id
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ approved: true, company_id: selectedCompanyId })
      .eq("id", userId);

    if (updateError) {
      toast({ title: "Error approving user", variant: "destructive" });
      return;
    }

    // Upsert user role with the selected company
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: 'staff', company_id: selectedCompanyId },
        { onConflict: 'user_id,company_id' }
      );

    if (roleError) {
      console.error("Error updating role:", roleError);
    }

    toast({ title: "User approved successfully" });
    fetchPendingUsers();
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (error) {
      toast({ title: "Error rejecting user", variant: "destructive" });
      return;
    }

    toast({ title: "User registration rejected" });
    fetchPendingUsers();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">User Approvals</h1>
        <p className="text-muted-foreground">Approve or reject pending user registrations</p>
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
        <p className="text-muted-foreground">Loading...</p>
      ) : pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No pending user approvals</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingUsers.map((user) => {
            const existingCompany = companies.find(c => c.id === user.company_id);
            const selectedCompanyId = selectedCompanies[user.id];
            const canApprove = !!selectedCompanyId;
            
            return (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{user.full_name || "No Name"}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Requested: {user.approval_requested_at ? new Date(user.approval_requested_at).toLocaleString() : 'N/A'}
                  </p>
                  
                  {/* Camp Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assign to Camp</label>
                    <Select
                      value={selectedCompanyId || ""}
                      onValueChange={(value) => handleCompanySelect(user.id, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a camp..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(user.id)}
                      className="flex-1"
                      disabled={!canApprove}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(user.id)}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
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
