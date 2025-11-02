import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { CheckCircle, XCircle, Clock, Shield, Building2 } from "lucide-react";

export default function UserApprovals() {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isSuperAdmin } = usePermissions();
  const { currentCompany } = useCompany();

  useEffect(() => {
    fetchPendingUsers();

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
  }, []);

  const fetchPendingUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("approved", false)
      .order("approval_requested_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching pending users", variant: "destructive" });
      setLoading(false);
      return;
    }
    setPendingUsers(data || []);
    setLoading(false);
  };

  const handleApprove = async (userId: string) => {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ approved: true })
      .eq("id", userId);

    if (updateError) {
      toast({ title: "Error approving user", variant: "destructive" });
      return;
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .update({ role: 'staff' })
      .eq("user_id", userId);

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
          {pendingUsers.map((user) => (
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
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Requested: {new Date(user.approval_requested_at).toLocaleString()}
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(user.id)}
                    className="flex-1"
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
          ))}
        </div>
      )}
    </div>
  );
}
