import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSessionInitialization() {
  useEffect(() => {
    // Initialize session on mount
    const initializeSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        // Explicitly set the session to ensure it's active
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        console.log('Session initialized on app load');
      }
    };

    initializeSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        if (event === 'SIGNED_IN' && session) {
          // Ensure session is set when user signs in
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
