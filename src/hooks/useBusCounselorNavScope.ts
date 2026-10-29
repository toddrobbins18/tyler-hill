import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  canViewAllTransportBuses,
  isBusCounselorMenuAllowed,
  isBusCounselorNavLocked,
  loadUserAssignedTransportBus,
} from "@/lib/transportBusCounselor";

export function useBusCounselorNavScope() {
  const { user, isSuperAdmin, userRole, hasPagePermission } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [assignedBus, setAssignedBus] = useState<string | null>(null);
  const [assignedLoading, setAssignedLoading] = useState(true);

  useEffect(() => {
    if (!companyId || !user?.id) {
      setAssignedBus(null);
      setAssignedLoading(false);
      return;
    }
    let cancelled = false;
    setAssignedLoading(true);
    void loadUserAssignedTransportBus(supabase, user.id).then((bus) => {
      if (!cancelled) {
        setAssignedBus(bus);
        setAssignedLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, user?.id]);

  const canViewAll = useMemo(
    () =>
      canViewAllTransportBuses({
        isSuperAdmin,
        isAdmin: userRole === "admin",
        hasTransportAdmin: companyId ? hasPagePermission(companyId, "transport-admin") : false,
      }),
    [isSuperAdmin, userRole, companyId, hasPagePermission],
  );

  const hasTransportCoordinatorAccess = useMemo(
    () => (companyId ? hasPagePermission(companyId, "transportation") : false),
    [companyId, hasPagePermission],
  );

  const isNavLocked = useMemo(
    () => isBusCounselorNavLocked({ canViewAll, assignedBus }),
    [canViewAll, assignedBus],
  );

  const allowMenuItem = useCallback(
    (menuId: string) => {
      if (!isNavLocked) return true;
      return isBusCounselorMenuAllowed(menuId);
    },
    [isNavLocked],
  );

  return {
    assignedBus,
    assignedLoading,
    canViewAll,
    hasTransportCoordinatorAccess,
    isNavLocked,
    allowMenuItem,
    busScopeLabel: isNavLocked && assignedBus ? assignedBus : null,
  };
}
