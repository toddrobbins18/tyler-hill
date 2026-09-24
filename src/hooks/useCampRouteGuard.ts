import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { isRouteAllowedForCompany } from "@/lib/campRouteAccess";

/** Redirect to dashboard when the current page is not available for the selected camp. */
export function useCampRouteGuard() {
  const { currentCompany } = useCompany();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentCompany?.id) return;

    if (!isRouteAllowedForCompany(location.pathname, currentCompany)) {
      navigate("/", { replace: true });
    }
  }, [currentCompany?.id, currentCompany?.slug, currentCompany?.camp_type, location.pathname, navigate]);
}
