import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import Staff from "./pages/Staff";
import StaffProfile from "./pages/StaffProfile";
import Transportation from "./pages/Transportation";
import DailyNotes from "./pages/DailyNotes";
import Awards from "./pages/Awards";
import ChildProfile from "./pages/ChildProfile";
import Messages from "./pages/Messages";
import Admin from "./pages/Admin";
import Nurse from "./pages/Nurse";
import Menu from "./pages/Menu";
import SpecialMeals from "./pages/SpecialMeals";
import RainyDaySchedule from "./pages/RainyDaySchedule";
import EvaluationQuestions from "./pages/EvaluationQuestions";
import RolePermissions from "./pages/RolePermissions";
import DivisionPermissions from "./pages/DivisionPermissions";
import IncidentReports from "./pages/IncidentReports";
import MasterCalendar from "./pages/MasterCalendar";
import SportsCalendar from "./pages/SportsCalendar";
import ActivitiesFieldTrips from "./pages/ActivitiesFieldTrips";
import DailySchedule from "./pages/DailySchedule";
import UserApprovals from "./pages/UserApprovals";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur px-6">
                        <SidebarTrigger />
                      </header>
                      <main className="flex-1 p-6 md:p-8 bg-background">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/roster" element={<Roster />} />
                          <Route path="/staff" element={<Staff />} />
                          <Route path="/staff/:id" element={<StaffProfile />} />
                          <Route path="/nurse" element={<Nurse />} />
                          <Route path="/menu" element={<Menu />} />
                          <Route path="/special-meals" element={<SpecialMeals />} />
                          <Route path="/rainy-day" element={<RainyDaySchedule />} />
                          <Route path="/evaluation-questions" element={<EvaluationQuestions />} />
                          <Route path="/role-permissions" element={<RolePermissions />} />
                          <Route path="/division-permissions" element={<DivisionPermissions />} />
                          <Route path="/transportation" element={<Transportation />} />
                          <Route path="/notes" element={<DailyNotes />} />
                          <Route path="/awards" element={<Awards />} />
                          <Route path="/incidents" element={<IncidentReports />} />
                          <Route path="/calendar" element={<MasterCalendar />} />
                          <Route path="/sports-calendar" element={<SportsCalendar />} />
                          <Route path="/activities" element={<ActivitiesFieldTrips />} />
                          <Route path="/daily-schedule" element={<DailySchedule />} />
                          <Route path="/messages" element={<Messages />} />
                          <Route path="/child/:id" element={<ChildProfile />} />
                          <Route path="/admin" element={<Admin />} />
                          <Route path="/user-approvals" element={<UserApprovals />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
