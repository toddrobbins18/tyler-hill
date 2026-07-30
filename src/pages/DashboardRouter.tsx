import { useCompany } from "@/contexts/CompanyContext";
import { isDayCampCompany } from "@/lib/camps";
import Dashboard from "@/pages/Dashboard";
import DayCampDashboard from "@/pages/daycamp/DayCampDashboard";

export default function DashboardRouter() {
  const { currentCompany } = useCompany();

  if (isDayCampCompany(currentCompany)) {
    return <DayCampDashboard />;
  }

  return <Dashboard />;
}
