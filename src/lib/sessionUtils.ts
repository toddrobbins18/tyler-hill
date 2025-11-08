import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function validateAndRefreshSession(): Promise<boolean> {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Session validation error:", error);
      toast.error("Session error. Please log in again.");
      return false;
    }

    if (!session) {
      console.error("No active session found");
      toast.error("Your session has expired. Please log in again.");
      await supabase.auth.signOut();
      window.location.href = "/auth";
      return false;
    }

    // Check if token exists
    if (!session.access_token) {
      console.error("Session exists but no access token found");
      toast.error("Authentication error. Please log in again.");
      await supabase.auth.signOut();
      window.location.href = "/auth";
      return false;
    }

    // Refresh session if it's close to expiring (within 5 minutes)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresInMs = (expiresAt * 1000) - Date.now();
      const fiveMinutesInMs = 5 * 60 * 1000;
      
      if (expiresInMs < fiveMinutesInMs) {
        console.log("Session expiring soon, refreshing...");
        const { data: { session: newSession }, error: refreshError } = 
          await supabase.auth.refreshSession();
        
        if (refreshError || !newSession) {
          console.error("Session refresh failed:", refreshError);
          toast.error("Failed to refresh session. Please log in again.");
          await supabase.auth.signOut();
          window.location.href = "/auth";
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error("Unexpected error during session validation:", error);
    toast.error("Authentication error. Please try logging in again.");
    return false;
  }
}
