import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'staff' | 'division_leader' | 'specialist' | 'viewer' | 'super_admin' | 'health_center';

interface AuthContextType {
  user: User | null;
  userRoles: AppRole[];
  userRole: AppRole | null;
  isSuperAdmin: boolean;
  userDivisions: string[];
  loading: boolean;
  // All permissions keyed by companyId -> menuItem -> boolean
  allPermissions: Record<string, Record<string, boolean>>;
  // Quickly check permission without DB call
  hasPagePermission: (companyId: string, menuItem: string) => boolean;
  // Force refetch
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userDivisions, setUserDivisions] = useState<string[]>([]);
  const [allPermissions, setAllPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  
  const hasInitializedRef = useRef(false);

  const fetchAuthData = useCallback(async () => {
    try {
      // Single auth call for the entire app
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        setUser(null);
        setUserRoles([]);
        setUserRole(null);
        setIsSuperAdmin(false);
        setUserDivisions([]);
        setAllPermissions({});
        setLoading(false);
        return;
      }

      setUser(currentUser);

      // Fetch roles first (small + needed to scope the rest)
      const rolesResult = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id);

      const roles = (rolesResult.data || []).map((r) => r.role as AppRole);
      const isSuperAdminUser = roles.includes('super_admin');
      const effectiveRole = isSuperAdminUser
        ? 'super_admin'
        : roles.includes('admin')
          ? 'admin'
          : roles[0] || null;

      setUserRoles(roles);
      setUserRole(effectiveRole);
      setIsSuperAdmin(isSuperAdminUser);

      // Fetch only what we need (skip divisions for full-access roles)
      const emptyResult = { data: [] as any[], error: null };

      const divisionsPromise = (!roles.includes('admin') && !isSuperAdminUser)
        ? supabase
            .from('division_permissions')
            .select('division_id')
            .eq('user_id', currentUser.id)
            .eq('can_access', true)
        : Promise.resolve(emptyResult);

      const permissionsPromise = roles.length > 0
        ? supabase
            .from('role_permissions')
            .select('company_id, menu_item, role, can_access')
            .eq('can_access', true)
            .in('role', roles as any)
        : Promise.resolve(emptyResult);

      const [divisionsResult, permissionsResult] = await Promise.all([
        divisionsPromise,
        permissionsPromise,
      ]);

      // Process divisions
      if (!roles.includes('admin') && !isSuperAdminUser) {
        setUserDivisions((divisionsResult.data || []).map((d: any) => d.division_id));
      } else {
        setUserDivisions([]);
      }

      // Build permissions map: companyId -> menuItem -> true
      const permMap: Record<string, Record<string, boolean>> = {};

      for (const perm of (permissionsResult.data || []) as any[]) {
        if (!permMap[perm.company_id]) {
          permMap[perm.company_id] = {};
        }
        permMap[perm.company_id][perm.menu_item] = true;
      }

      setAllPermissions(permMap);
      hasInitializedRef.current = true;
    } catch (error) {
      console.error('[AuthContext] Error fetching auth data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Defer to avoid recursive state updates
        setTimeout(() => fetchAuthData(), 0);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserRoles([]);
        setUserRole(null);
        setIsSuperAdmin(false);
        setUserDivisions([]);
        setAllPermissions({});
        setLoading(false);
        hasInitializedRef.current = false;
      }
      // TOKEN_REFRESHED doesn't need re-fetch - data is still valid
    });

    return () => subscription.unsubscribe();
  }, [fetchAuthData]);

  // Fast permission check - no DB call
  const hasPagePermission = useCallback((companyId: string, menuItem: string): boolean => {
    // Super admins have access to everything
    if (isSuperAdmin) return true;
    
    // Check the preloaded permissions map
    return allPermissions[companyId]?.[menuItem] === true;
  }, [isSuperAdmin, allPermissions]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userRoles,
        userRole,
        isSuperAdmin,
        userDivisions,
        loading,
        allPermissions,
        hasPagePermission,
        refetch: fetchAuthData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
