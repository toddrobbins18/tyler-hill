import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(true);

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

  return <>{children}</>;
}
