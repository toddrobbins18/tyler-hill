import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { canViewAllTransportBuses, filterRoutesForAssignedBus } from "@/lib/transportBusCounselor";
import {
  loadBusRunEnrollmentContext,
  type BusRunEnrollmentContext,
} from "@/lib/transportBusRunContext";
import { buildRunRoutes, loadTransportRunBoard, type TransportRunBoard } from "@/lib/transportRunBoard";

export function useFilteredBusRoutes(runDate: string, timeOfDay: "am" | "pm") {
  const { isSuperAdmin, userRole, hasPagePermission, busAttendanceOnly, assignedTransportBus } = useAuth();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const companyId = currentCompany?.id;

  const [board, setBoard] = useState<TransportRunBoard | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [enrollmentCtx, setEnrollmentCtx] = useState<BusRunEnrollmentContext | null>(null);
  const assignedBus = assignedTransportBus;

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

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setBoardLoading(true);
    void (async () => {
      try {
        const [loadedBoard, ctx] = await Promise.all([
          loadTransportRunBoard(supabase, companyId, currentSeason, runDate),
          loadBusRunEnrollmentContext(supabase, companyId, currentSeason, runDate),
        ]);
        if (!cancelled) {
          setBoard(loadedBoard);
          setEnrollmentCtx(ctx);
        }
      } catch (err) {
        console.error("[Transport] Load bus run context error:", err);
      } finally {
        if (!cancelled) setBoardLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, currentSeason, runDate]);

  const allRoutes = useMemo(
    () => (board ? buildRunRoutes(board, timeOfDay, { runDate }) : []),
    [board, timeOfDay, runDate],
  );

  const routes = useMemo(
    () =>
      filterRoutesForAssignedBus(allRoutes, {
        assignedBus,
        canViewAll,
        hasTransportCoordinatorAccess,
        busAttendanceOnly,
      }),
    [allRoutes, assignedBus, canViewAll, hasTransportCoordinatorAccess, busAttendanceOnly],
  );

  return {
    companyId,
    currentSeason,
    board,
    boardLoading,
    routes,
    allRoutes,
    enrollmentCtx,
    assignedBus,
    canViewAll,
    hasTransportCoordinatorAccess,
    busScopeLabel: !canViewAll && (busAttendanceOnly || assignedBus) && assignedBus ? assignedBus : null,
  };
}
