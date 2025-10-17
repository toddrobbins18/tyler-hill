import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'staff' | 'division_leader' | 'specialist' | 'viewer';

export function usePermissions() {
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [userDivisions, setUserDivisions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Fetch user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role as AppRole);
      }

      // Fetch user divisions (only if not admin)
      if (roleData?.role !== 'admin') {
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
  const canAccessPage = async (pageName: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('role_permissions')
        .select('can_access')
        .eq('role', userRole)
        .eq('menu_item', pageName)
        .maybeSingle();

      return data?.can_access ?? false;
    } catch (error) {
      console.error('Error checking page access:', error);
      return false;
    }
  };

  // Check if user can see data for a division
  const canSeeDivision = (divisionId: string): boolean => {
    // Admins and specialists can see all divisions
    if (userRole === 'admin' || userRole === 'specialist') {
      return true;
    }
    
    // Other roles can only see their assigned divisions
    return userDivisions.includes(divisionId);
  };

  // Get division filter for queries
  const getDivisionFilter = (): string[] | null => {
    // Admins and specialists see all divisions (no filter)
    if (userRole === 'admin' || userRole === 'specialist') {
      return null;
    }
    
    // Other roles see only their divisions
    return userDivisions.length > 0 ? userDivisions : [];
  };

  return {
    userRole,
    userDivisions,
    loading,
    canAccessPage,
    canSeeDivision,
    getDivisionFilter,
  };
}
