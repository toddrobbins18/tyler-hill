import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export const useSessionRefresh = () => {
  const [isSessionValid, setIsSessionValid] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check session validity immediately
    checkSessionValidity();

    // Check session validity every 5 minutes
    const interval = setInterval(checkSessionValidity, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const checkSessionValidity = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Session check error:", error);
        handleExpiredSession();
        return;
      }

      if (!session) {
        handleExpiredSession();
        return;
      }

      // Check if session is expired
      const expiresAt = session.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now()) {
        handleExpiredSession();
        return;
      }

      // If session expires in less than 10 minutes, try to refresh
      if (expiresAt && expiresAt * 1000 - Date.now() < 10 * 60 * 1000) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("Session refresh error:", refreshError);
          handleExpiredSession();
        }
      }

      setIsSessionValid(true);
    } catch (error) {
      console.error("Session validation error:", error);
      handleExpiredSession();
    }
  };

  const handleExpiredSession = async () => {
    setIsSessionValid(false);
    await supabase.auth.signOut();
    toast({
      title: "Session Expired",
      description: "Your session has expired. Please log in again.",
      variant: "destructive",
    });
    navigate("/auth");
  };

  return { isSessionValid };
};
