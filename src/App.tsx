import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UserProfileDropdown } from "@/components/UserProfileDropdown";
import { NotificationBell } from "@/components/NotificationBell";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SeasonProvider } from "@/contexts/SeasonContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useSessionInitialization } from "@/hooks/useSessionInitialization";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import Staff from "./pages/Staff";
import StaffProfile from "./pages/StaffProfile";
import Transportation from "./pages/Transportation";
import DailyNotes from "./pages/DailyNotes";
import DailyWolfPrintable from "./pages/DailyWolfPrintable";
import DailyWolfManagement from "./pages/DailyWolfManagement";
import ChildProfile from "./pages/ChildProfile";
import Messages from "./pages/Messages";
import Admin from "./pages/Admin";
import Menu from "./pages/Menu";
import SpecialMeals from "./pages/SpecialMeals";
import RainyDaySchedule from "./pages/RainyDaySchedule";
import EvaluationQuestions from "./pages/EvaluationQuestions";
import RolePermissions from "./pages/RolePermissions";
import DivisionPermissions from "./pages/DivisionPermissions";
import SpecialistSportAssignments from "./pages/SpecialistSportAssignments";
import MasterCalendar from "./pages/MasterCalendar";
import SportsCalendar from "./pages/SportsCalendar";
import ActivitiesFieldTrips from "./pages/ActivitiesFieldTrips";
import SpecialEventsActivities from "./pages/SpecialEventsActivities";
import TutoringTherapy from "./pages/TutoringTherapy";
import UserApprovals from "./pages/UserApprovals";
import Awards from "./pages/Awards";
import IncidentReports from "./pages/IncidentReports";
import Nurse from "./pages/Nurse";
import SportsAcademy from "./pages/SportsAcademy";
import Reports from "./pages/Reports";
import RosterTemplates from "./pages/RosterTemplates";
import ODManagement from "./pages/ODManagement";
import DailySchedule from "./pages/DailySchedule";
import Appointments from "./pages/Appointments";
import NotificationPreferences from "./pages/NotificationPreferences";
import ElectiveSignUp from "./pages/ElectiveSignUp";
import OwlPay from "./pages/OwlPay";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import UpdatePassword from "./pages/UpdatePassword";
import Privacy from "./pages/Privacy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduce stale cross-screen data without changing product workflows.
      staleTime: 5000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 15000,
      refetchIntervalInBackground: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Hook to handle password recovery redirects at app level
function usePasswordRecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check URL hash for recovery token on any page
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('type=signup'))) {
      // Redirect to update-password page with the hash
      navigate('/update-password' + hash, { replace: true });
      return;
    }

    // Also listen for PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/update-password', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);
}

function AppContent() {
  useSessionInitialization();
  usePasswordRecoveryRedirect();
  
  return (
    <>
      <Toaster />
      <Sonner />
      <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/update-password" element={<UpdatePassword />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route
                  path="*"
                  element={
                    <ProtectedRoute>
                      <SidebarProvider>
                        <div className="flex min-h-screen w-full">
                          <AppSidebar />
                          <div className="flex-1 flex flex-col">
                            <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur px-6">
                              <SidebarTrigger />
                              <div className="flex items-center gap-1">
                                <NotificationBell />
                                <UserProfileDropdown />
                              </div>
                            </header>
                            <main className="flex-1 p-6 md:p-8 bg-background">
                              <Routes>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/roster" element={<Roster />} />
                                <Route path="/staff" element={<Staff />} />
                                <Route path="/staff/:id" element={<StaffProfile />} />
                                <Route path="/menu" element={<Menu />} />
                                <Route path="/special-meals" element={<SpecialMeals />} />
                                <Route path="/rainy-day" element={<RainyDaySchedule />} />
                                <Route path="/evaluation-questions" element={<EvaluationQuestions />} />
                                <Route path="/role-permissions" element={<RolePermissions />} />
                                <Route path="/division-permissions" element={<DivisionPermissions />} />
                                <Route path="/specialist-sport-assignments" element={<SpecialistSportAssignments />} />
                                <Route path="/transportation" element={<Transportation />} />
                                <Route path="/notes" element={<DailyNotes />} />
                                <Route path="/daily-wolf-printable" element={<DailyWolfPrintable />} />
                                <Route path="/daily-wolf-management" element={<DailyWolfManagement />} />
                                <Route path="/calendar" element={<MasterCalendar />} />
                                <Route path="/athletics" element={<SportsCalendar />} />
                                <Route path="/activities" element={<ActivitiesFieldTrips />} />
                                <Route path="/special-events" element={<SpecialEventsActivities />} />
                                <Route path="/tutoring-therapy" element={<TutoringTherapy />} />
                                <Route path="/messages" element={<Messages />} />
                                <Route path="/child/:id" element={<ChildProfile />} />
                                <Route path="/admin" element={<Admin />} />
                                <Route path="/user-approvals" element={<UserApprovals />} />
                                <Route path="/awards" element={<Awards />} />
                                <Route path="/incidents" element={<IncidentReports />} />
                                <Route path="/nurse" element={<Nurse />} />
                                <Route path="/sports-academy" element={<SportsAcademy />} />
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/roster-templates" element={<RosterTemplates />} />
                                <Route path="/od-management" element={<ODManagement />} />
                                <Route path="/appointments" element={<Appointments />} />
                                <Route path="/daily-schedule" element={<DailySchedule />} />
                                <Route path="/elective-signup" element={<ElectiveSignUp />} />
                                <Route path="/owl-pay" element={<OwlPay />} />
                                <Route path="/notification-preferences" element={<NotificationPreferences />} />
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </main>
                          </div>
                        </div>
                      </SidebarProvider>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CompanyProvider>
            <SeasonProvider>
              <TooltipProvider>
                <AppContent />
              </TooltipProvider>
            </SeasonProvider>
          </CompanyProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
