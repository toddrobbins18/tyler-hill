import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export type AppRole = 'admin' | 'staff' | 'division_leader' | 'specialist' | 'viewer' | 'super_admin' | 'health_center';

/**
 * Division Access Control Model:
 * 
 * - super_admin: ALL divisions, ALL companies
 * - admin: ALL divisions in their company
 * - staff: ALL divisions in their company
 * - specialist: ALL divisions in their company
 * - division_leader: ONLY assigned divisions (via division_permissions)
 * - viewer: ONLY assigned divisions (via division_permissions)
 * 
 * Database Level (RLS Policies):
 * - Policies automatically filter data based on user's accessible divisions
 * - Uses get_user_divisions() function to retrieve assigned divisions
 * 
 * Client Level (UI Filtering):
 * - Use getDivisionFilter() to filter queries
 * - Returns null for users with full access (admin, staff, specialist)
 * - Returns array of division IDs for division_leader and viewer roles
 */
export function usePermissions() {
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [userDivisions, setUserDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const { currentCompany } = useCompany();

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch all user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (rolesData && rolesData.length > 0) {
        // Get all roles
        const roles = rolesData.map(r => r.role as AppRole);
        
        // Prioritize roles: super_admin > admin > others
        const isSuperAdminUser = roles.includes('super_admin');
        const effectiveRole = isSuperAdminUser ? 'super_admin' : 
                              roles.includes('admin') ? 'admin' : roles[0];
        
        setUserRole(effectiveRole);
        setUserRoles(roles);
        setIsSuperAdmin(isSuperAdminUser);
      }

      // Fetch user divisions (only if not admin or super_admin)
      if (!rolesData?.some(r => r.role === 'admin' || r.role === 'super_admin')) {
        const { data: divisionData } = await supabase
          .from('division_permissions')
          .select('division_id')
          .eq('user_id', user.id)
          .eq('can_access', true);

        if (divisionData) {
          setUserDivisions(divisionData.map(d => d.division_id));
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user can access a page
  const canAccessPage = async (
    pageName: string,
    options?: { respectPermissions?: boolean }
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log(`[usePermissions] canAccessPage(${pageName}): No user`);
        return false;
      }

      // Super admins bypass all permission checks UNLESS we're filtering menus
      if (isSuperAdmin && !options?.respectPermissions) {
        console.log(`[usePermissions] canAccessPage(${pageName}): Super admin bypass`);
        return true;
      }
      
      if (!currentCompany) {
        console.warn(`[usePermissions] canAccessPage(${pageName}): No currentCompany`);
        return false;
      }

      // Check if ANY of the user's roles grant access to this page
      const rolesToCheck = userRoles.length > 0 ? userRoles : (userRole ? [userRole] : []);
      
      console.log(`[usePermissions] canAccessPage(${pageName}): roles=${rolesToCheck.join(',')}, company=${currentCompany.name}`);
      
      if (rolesToCheck.length === 0) {
        console.warn(`[usePermissions] canAccessPage(${pageName}): No roles to check`);
        return false;
      }

      const { data, error } = await supabase
        .from('role_permissions')
        .select('can_access')
        .eq('company_id', currentCompany.id)
        .in('role', rolesToCheck)
        .eq('menu_item', pageName)
        .eq('can_access', true)
        .limit(1);

      if (error) {
        console.error(`[usePermissions] canAccessPage(${pageName}): DB error`, error);
        return false;
      }

      const hasAccess = data && data.length > 0;
      console.log(`[usePermissions] canAccessPage(${pageName}): result=${hasAccess}`);
      return hasAccess;
    } catch (error) {
      console.error(`[usePermissions] canAccessPage(${pageName}): Exception`, error);
      return false;
    }
  };

  // Check if user can see data for a division
  const canSeeDivision = (divisionId: string): boolean => {
    // Admins, super_admins, and specialists can see all divisions
    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'specialist') {
      return true;
    }
    
    // Other roles can only see their assigned divisions
    return userDivisions.includes(divisionId);
  };

  // Get division filter for queries
  const getDivisionFilter = (): string[] | null => {
    // Admins, super_admins, and specialists see all divisions (no filter)
    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'specialist') {
      return null;
    }
    
    // Other roles see only their divisions
    return userDivisions.length > 0 ? userDivisions : [];
  };

  return {
    userRole,
    userRoles,
    userDivisions,
    loading,
    canAccessPage,
    canSeeDivision,
    getDivisionFilter,
    isSuperAdmin,
  };
}
