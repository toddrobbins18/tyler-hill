import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSessionInitialization() {
  useEffect(() => {
    let cancelled = false;

    // Keep this extremely lightweight: just ensure we can read the cached session.
    // Avoid calling setSession() on load (it can trigger extra auth traffic).
    const initializeSession = async () => {
      const timeoutId = setTimeout(() => {
        if (!cancelled) {
          console.warn('Session initialization timeout');
        }
      }, 5000);

      try {
        await supabase.auth.getSession();
      } catch (error) {
        if (!cancelled) {
          console.error('Session initialization failed:', error);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    initializeSession();

    return () => {
      cancelled = true;
    };
  }, []);
}
