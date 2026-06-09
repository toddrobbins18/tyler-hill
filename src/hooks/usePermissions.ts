import { useCallback, useMemo } from 'react';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

/** Stable empty array — avoids useEffect loops when used as a dependency. */
const EMPTY_DIVISIONS: string[] = [];
// Re-export AppRole for backward compatibility
export type { AppRole } from '@/contexts/AuthContext';

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
  const { 
    userRole, 
    userRoles, 
    userDivisions,
    userDivisionsByCompany,
    loading, 
    isSuperAdmin,
    hasPagePermission 
  } = useAuth();
  const { currentCompany } = useCompany();

  const scopedUserDivisions = useMemo((): string[] => {
    if (currentCompany?.id) {
      return userDivisionsByCompany?.[currentCompany.id] ?? EMPTY_DIVISIONS;
    }
    return userDivisions.length > 0 ? userDivisions : EMPTY_DIVISIONS;
  }, [currentCompany?.id, userDivisionsByCompany, userDivisions]);

  const userDivisionsKey = useMemo(
    () => scopedUserDivisions.join(','),
    [scopedUserDivisions],
  );

  // Check if user can access a page - now synchronous, no DB call!
  const canAccessPage = useCallback(async (
    pageName: string,
    options?: { respectPermissions?: boolean }
  ): Promise<boolean> => {
    // Super admins bypass all permission checks UNLESS we're filtering menus
    if (isSuperAdmin && !options?.respectPermissions) {
      return true;
    }
    
    if (!currentCompany) {
      return false;
    }

    // Use the preloaded permissions from AuthContext
    return hasPagePermission(currentCompany.id, pageName);
  }, [currentCompany?.id, isSuperAdmin, hasPagePermission]);

  // Roles with full division access (can see all divisions in their company)
  const fullDivisionAccessRoles: AppRole[] = ['admin', 'super_admin', 'specialist', 'staff', 'health_center'];

  // Check if user can see data for a division
  const canSeeDivision = useCallback((divisionId: string): boolean => {
    // Roles with full access can see all divisions
    if (userRole && fullDivisionAccessRoles.includes(userRole)) {
      return true;
    }
    
    // Other roles (division_leader, viewer) can only see their assigned divisions
    return scopedUserDivisions.includes(divisionId);
  }, [userRole, scopedUserDivisions]);

  // Get division filter for queries
  const getDivisionFilter = useCallback((): string[] | null => {
    // Roles with full access see all divisions (no filter)
    if (userRole && fullDivisionAccessRoles.includes(userRole)) {
      return null;
    }
    
    // Other roles (division_leader, viewer) see only their assigned divisions
    // Empty array = defer to RLS (same as Roster when client ids aren't loaded)
    return scopedUserDivisions.length > 0 ? scopedUserDivisions : [];
  }, [userRole, scopedUserDivisions]);

  return {
    userRole,
    userRoles,
    userDivisions: scopedUserDivisions,
    userDivisionsKey,
    loading,
    canAccessPage,
    canSeeDivision,
    getDivisionFilter,
    isSuperAdmin,
  };
}
