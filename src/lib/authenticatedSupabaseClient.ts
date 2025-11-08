import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Creates a new Supabase client instance with the current JWT token explicitly set in headers.
 * This ensures the token is included in database requests, avoiding RLS authentication issues.
 */
export async function getAuthenticatedSupabaseClient() {
  // Get current session
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Failed to get session for authenticated client:', error);
    throw new Error('Authentication required. Please log in again.');
  }

  if (!session?.access_token) {
    throw new Error('No valid session found. Please log in again.');
  }

  console.log('Creating authenticated client with JWT token:', {
    hasToken: !!session.access_token,
    userId: session.user?.id,
    expiresAt: session.expires_at,
  });

  // Create a NEW client instance with explicit JWT token in headers
  const authenticatedClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
    auth: {
      persistSession: false, // Don't persist since we're using explicit token
      autoRefreshToken: false,
    },
  });

  return authenticatedClient;
}
