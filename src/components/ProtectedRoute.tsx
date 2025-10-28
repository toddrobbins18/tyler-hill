import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Shield } from "lucide-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(true);
  const [hasPageAccess, setHasPageAccess] = useState(true);
  const { canAccessPage, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        checkApprovalStatus();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (approved && !permissionsLoading) {
      checkPageAccess();
    }
  }, [location.pathname, approved, permissionsLoading]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    await checkApprovalStatus();
  };

  const checkApprovalStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("approved")
      .eq("id", user.id)
      .single();

    if (profile && !profile.approved) {
      setApproved(false);
    }

    setLoading(false);
  };

  const checkPageAccess = async () => {
    // Extract page name from path
    const path = location.pathname;
    let pageName = path.substring(1) || "dashboard";
    
    // Remove any child route params (e.g., /child/123 -> child)
    pageName = pageName.split('/')[0];
    
    // Check if user has access to this page
    const hasAccess = await canAccessPage(pageName);
    setHasPageAccess(hasAccess);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Account Pending Approval</h1>
          <p className="text-muted-foreground">
            Your account is awaiting administrator approval. You will be able to access the system once an admin approves your registration.
          </p>
          <button
            onClick={() => supabase.auth.signOut().then(() => navigate("/auth"))}
            className="text-primary hover:underline"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!hasPageAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You don't have permission to access this page. Please contact your administrator.
          </p>
          <button 
            onClick={() => navigate("/")} 
            className="text-primary hover:underline"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
