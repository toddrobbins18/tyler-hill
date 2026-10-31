import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  canViewAllTransportBuses,
  isBusCounselorMenuAllowed,
  isBusCounselorNavLocked,
} from "@/lib/transportBusCounselor";

export function useBusCounselorNavScope() {
  const {
    user,
    isSuperAdmin,
    userRole,
    hasPagePermission,
    busAttendanceOnly,
    assignedTransportBus,
    loading: authLoading,
  } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const assignedBus = assignedTransportBus;
  const assignedLoading = authLoading;

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
    () => isBusCounselorNavLocked({ canViewAll, busAttendanceOnly }),
    [canViewAll, busAttendanceOnly],
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
