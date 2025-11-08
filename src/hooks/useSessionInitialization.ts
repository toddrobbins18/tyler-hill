import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSessionInitialization() {
  useEffect(() => {
    // Initialize session on mount with timeout protection
    const initializeSession = async () => {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session initialization timeout')), 5000)
      );
      
      try {
        await Promise.race([
          (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              // Explicitly set the session to ensure it's active
              await supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              });
              console.log('Session initialized on app load');
            }
          })(),
          timeout
        ]);
      } catch (error) {
        console.error('Session initialization failed:', error);
      }
    };

    initializeSession();

    // Listen for auth state changes (for logging only, don't call setSession here)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event);
        // Just log - don't call setSession to avoid infinite loop
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
