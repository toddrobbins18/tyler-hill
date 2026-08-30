import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Shield } from "lucide-react";

// Map route paths to their menu item names for permission checks
const routeToMenuMap: Record<string, string> = {
  'athletics': 'sports-calendar',
  'child': 'roster',
  'staff-profile': 'staff',
  'parent-portal-dashboard': 'parent-portal',
};

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [approved, setApproved] = useState(true);
  const [approvalChecked, setApprovalChecked] = useState(false);
  
  const { user, loading: authLoading, hasPagePermission, isSuperAdmin } = useAuth();
  const { loading: companyLoading, currentCompany } = useCompany();

  // Extract page name from path
  const menuItem = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/day-camp/")) {
      const segment = path.slice("/day-camp/".length).split("/")[0];
      return routeToMenuMap[segment] || segment;
    }
    let pageName = path.substring(1) || "dashboard";
    pageName = pageName.split('/')[0];
    return routeToMenuMap[pageName] || pageName;
  }, [location.pathname]);

  // Calculate page access synchronously from preloaded permissions
  const hasPageAccess = useMemo(() => {
    if (!currentCompany) return true; // Still loading, assume access
    if (isSuperAdmin) return true;
    return hasPagePermission(currentCompany.id, menuItem);
  }, [currentCompany?.id, menuItem, isSuperAdmin, hasPagePermission]);

  // Check auth and redirect if needed
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Check approval status once when user loads
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user) {
        setApprovalChecked(true);
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
      setApprovalChecked(true);
    };

    if (user && !approvalChecked) {
      checkApprovalStatus();
    }
  }, [user, approvalChecked]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Show loading while auth or company is loading, or approval not yet checked
  if (authLoading || companyLoading || !approvalChecked) {
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
