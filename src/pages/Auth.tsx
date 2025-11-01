import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkUserCompany(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkUserCompany(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUserCompany = async (userId: string) => {
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('company_id, approved')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (!profile?.approved) {
        toast({
          title: "Pending Approval",
          description: "Your account is pending approval by an administrator.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      if (!profile?.company_id) {
        toast({
          title: "No Company Assigned",
          description: "Your account has no company assigned. Please contact an administrator.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      navigate("/");
    } catch (error) {
      console.error('Error checking user company:', error);
      toast({
        title: "Error",
        description: "Failed to verify account. Please try again.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
              <p className="text-muted-foreground">Sign in to manage The Nest</p>
            </div>
            <SupabaseAuth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: "hsl(var(--primary))",
                      brandAccent: "hsl(var(--primary))",
                    },
                  },
                },
              }}
              providers={[]}
            />
          </>
        )}
      </div>
    </div>
  );
}
