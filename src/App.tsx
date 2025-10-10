import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Dashboard from "./pages/Dashboard";
import Roster from "./pages/Roster";
import Transportation from "./pages/Transportation";
import DailyNotes from "./pages/DailyNotes";
import ChildProfile from "./pages/ChildProfile";
import Messages from "./pages/Messages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
                  <Route path="/transportation" element={<Transportation />} />
                  <Route path="/notes" element={<DailyNotes />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/child/:id" element={<ChildProfile />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
