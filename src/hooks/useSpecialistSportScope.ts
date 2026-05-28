import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";

/**
 * Specialists assigned to Tennis (etc.) should only manage/view that sport's academy + calendar data.
 * Admins and other roles are not sport-scoped.
 */
export function useSpecialistSportScope() {
  const { user, userRole, userRoles, isSuperAdmin } = useAuth();
  const { currentCompany } = useCompany();
  const [assignedSports, setAssignedSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isSpecialist =
    !isSuperAdmin &&
    (userRole === "specialist" || userRoles.includes("specialist"));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isSpecialist || !user?.id || !currentCompany?.id) {
        if (!cancelled) {
          setAssignedSports([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("specialist_sport_assignments")
        .select("sport")
        .eq("user_id", user.id)
        .eq("company_id", currentCompany.id);

      if (cancelled) return;

      if (error) {
        console.error("[useSpecialistSportScope] Failed to load sport assignments:", error);
        setAssignedSports([]);
      } else {
        setAssignedSports((data || []).map((row) => row.sport));
      }
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isSpecialist, user?.id, currentCompany?.id]);

  const hasSportScope = isSpecialist && assignedSports.length > 0;

  const canSeeSport = useCallback(
    (sportName: string | null | undefined): boolean => {
      if (!hasSportScope || !sportName) return !hasSportScope;
      return assignedSports.includes(sportName);
    },
    [assignedSports, hasSportScope],
  );

  const getSportFilter = useCallback((): string[] | null => {
    return hasSportScope ? assignedSports : null;
  }, [assignedSports, hasSportScope]);

  return {
    isSpecialist,
    assignedSports,
    hasSportScope,
    canSeeSport,
    getSportFilter,
    loading,
  };
}
