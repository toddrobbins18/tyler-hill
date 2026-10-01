import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import {
  canViewAllTransportBuses,
  filterRoutesForAssignedBus,
  loadUserAssignedTransportBus,
} from "@/lib/transportBusCounselor";
import {
  loadBusRunEnrollmentContext,
  type BusRunEnrollmentContext,
} from "@/lib/transportBusRunContext";
import { buildRunRoutes, loadTransportRunBoard, type TransportRunBoard } from "@/lib/transportRunBoard";

export function useFilteredBusRoutes(runDate: string, timeOfDay: "am" | "pm") {
  const { user, isSuperAdmin, userRole, hasPagePermission } = useAuth();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const companyId = currentCompany?.id;

  const [board, setBoard] = useState<TransportRunBoard | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [enrollmentCtx, setEnrollmentCtx] = useState<BusRunEnrollmentContext | null>(null);
  const [assignedBus, setAssignedBus] = useState<string | null>(null);

  const canViewAll = useMemo(
    () =>
      canViewAllTransportBuses({
        isSuperAdmin,
        isAdmin: userRole === "admin",
        hasTransportAdmin: companyId ? hasPagePermission(companyId, "transport-admin") : false,
        hasTransportation: companyId ? hasPagePermission(companyId, "transportation") : false,
      }),
    [isSuperAdmin, userRole, companyId, hasPagePermission],
  );

  useEffect(() => {
    if (!companyId || !user?.id) {
      setAssignedBus(null);
      return;
    }
    let cancelled = false;
    void loadUserAssignedTransportBus(supabase, user.id).then((bus) => {
      if (!cancelled) setAssignedBus(bus);
    });
    return () => { cancelled = true; };
  }, [companyId, user?.id]);

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
    () => (board ? buildRunRoutes(board, timeOfDay) : []),
    [board, timeOfDay],
  );

  const routes = useMemo(
    () => filterRoutesForAssignedBus(allRoutes, assignedBus, canViewAll),
    [allRoutes, assignedBus, canViewAll],
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
    busScopeLabel: !canViewAll && assignedBus ? assignedBus : null,
  };
}
