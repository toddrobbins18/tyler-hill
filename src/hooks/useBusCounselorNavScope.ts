import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  canViewAllTransportBuses,
  isPaperlessMenuAllowed,
  isPaperlessNavLocked,
  paperlessHomePath,
} from "@/lib/transportBusCounselor";

export function useBusCounselorNavScope() {
  const {
    isSuperAdmin,
    userRole,
    hasPagePermission,
    busAttendanceOnly,
    assignedTransportBus,
    groupAttendanceOnly,
    assignedGroups,
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
    () => isPaperlessNavLocked({ canViewAll, busAttendanceOnly, groupAttendanceOnly }),
    [canViewAll, busAttendanceOnly, groupAttendanceOnly],
  );

  const allowMenuItem = useCallback(
    (menuId: string) => {
      if (!isNavLocked) return true;
      return isPaperlessMenuAllowed(menuId, { busAttendanceOnly, groupAttendanceOnly });
    },
    [isNavLocked, busAttendanceOnly, groupAttendanceOnly],
  );

  const homePath = useMemo(
    () => paperlessHomePath({ busAttendanceOnly, groupAttendanceOnly }),
    [busAttendanceOnly, groupAttendanceOnly],
  );

  return {
    assignedBus,
    assignedLoading,
    canViewAll,
    hasTransportCoordinatorAccess,
    isNavLocked,
    allowMenuItem,
    busAttendanceOnly,
    groupAttendanceOnly,
    assignedGroups,
    homePath,
    busScopeLabel: isNavLocked && assignedBus ? assignedBus : null,
  };
}
