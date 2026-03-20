import { Home, Users, Truck, FileText, Mail, Award, UserCog, Shield, Pill, Utensils, ClipboardList, ClipboardEdit, Settings, CloudRain, AlertTriangle, Calendar, Trophy, Palmtree, BookOpen, Building2, LogOut, BarChart3, ListChecks, ClipboardCheck, Stethoscope, ExternalLink, ClipboardPen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import SeasonSelector from "@/components/SeasonSelector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Items that need conditional rendering will be handled in the component
const getMenuItems = (companySlug?: string) => {
  const baseItems: Array<{ title: string; url: string; icon: any; menuId: string; external?: boolean }> = [
    { title: companySlug === 'timber-lake-west' ? "Athletics" : "Sports Calendar", url: "/athletics", icon: Trophy, menuId: "sports-calendar" },
    { title: "Camper", url: "/roster", icon: Users, menuId: "roster" },
    { title: "Dashboard", url: "/", icon: Home, menuId: "dashboard" },
    { title: "Master Calendar", url: "/calendar", icon: Calendar, menuId: "calendar" },
    { title: "Menu", url: "/menu", icon: Utensils, menuId: "menu" },
    { title: "Rainy Day Schedule", url: "/rainy-day", icon: CloudRain, menuId: "rainy-day" },
    { title: "Special Events & Evening Activities", url: "/special-events", icon: Calendar, menuId: "special-events" },
    { title: "Staff", url: "/staff", icon: UserCog, menuId: "staff" },
    { title: "Tutoring & Therapy", url: "/tutoring-therapy", icon: BookOpen, menuId: "tutoring-therapy" },
  ];

  // Add common items for all companies
  baseItems.push(
    { title: "Activities & Field Trips", url: "/activities", icon: Palmtree, menuId: "activities" },
    { title: "Messages", url: "/messages", icon: Mail, menuId: "messages" },
    { title: "Transportation", url: "/transportation", icon: Truck, menuId: "transportation" },
    // OD Management available for all camps
    { title: "OD Management", url: "/od-management", icon: ClipboardCheck, menuId: "od-management" },
    { title: "Appointments", url: "/appointments", icon: Stethoscope, menuId: "appointments" }
  );

  // Daily Schedule for Timber Lake Camp only
  if (companySlug === 'timber-lake-camp') {
    baseItems.push(
      { title: "Daily Schedule", url: "/daily-schedule", icon: Calendar, menuId: "daily-schedule" }
    );
  }

  // Special Meals only for Tyler Hill Camp
  if (companySlug === 'tyler-hill-camp') {
    baseItems.push(
      { title: "Special Meals", url: "/special-meals", icon: Utensils, menuId: "special-meals" }
    );
  }

  // Add Daily Notes/News for all camps EXCEPT Timber Lake Camp
  if (companySlug !== 'timber-lake-camp') {
    baseItems.push({
      title: companySlug === 'tyler-hill-camp' ? "Daily News" : "Daily Notes",
      url: "/notes",
      icon: FileText,
      menuId: "notes"
    });
  }

  // Add Daily Wolf items for Timber Lake West
  if (companySlug === 'timber-lake-west') {
    baseItems.push(
      {
        title: "Daily Wolf Printable",
        url: "/daily-wolf-printable",
        icon: FileText,
        menuId: "daily-wolf-printable"
      },
      {
        title: "Daily Wolf Management",
        url: "/daily-wolf-management",
        icon: ClipboardEdit,
        menuId: "daily-wolf-management"
      }
    );
  }

  // Add Tiger Times and Elective Sign-Up for Timber Lake Camp
  if (companySlug === 'timber-lake-camp') {
    baseItems.push(
      {
        title: "Tiger Times",
        url: "/daily-wolf-management",
        icon: ClipboardEdit,
        menuId: "daily-wolf-management"
      },
      {
        title: "Elective Sign-Up",
        url: "https://tlcelective.lovable.app/signup",
        icon: ExternalLink,
        menuId: "elective-signup",
        external: true
      }
    );
  }

  baseItems.push({
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    menuId: "reports"
  });

  // Add Nurse for Timber Lake West (limited features) and all other companies
  baseItems.push({ title: "Nurse", url: "/nurse", icon: Pill, menuId: "nurse" });

  // Add these items for all companies
  baseItems.push(
    { title: "Awards", url: "/awards", icon: Award, menuId: "awards" },
    { title: "Incident Reports", url: "/incidents", icon: AlertTriangle, menuId: "incidents" },
    { title: "Sports Academy", url: "/sports-academy", icon: Trophy, menuId: "sports-academy" }
  );

  // Add Roster Templates for all camps
  baseItems.push({
    title: "Roster Templates",
    url: "/roster-templates",
    icon: ListChecks,
    menuId: "roster-templates"
  });

  return baseItems.sort((a, b) => a.title.localeCompare(b.title));
};

export function AppSidebar() {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const { userRoles, isSuperAdmin, loading: authLoading, hasPagePermission } = useAuth();
  const {
    currentCompany,
    availableCompanies,
    switchCompany,
    loading: companyLoading,
  } = useCompany();

  const items = useMemo(() => getMenuItems(currentCompany?.slug), [currentCompany?.slug]);

  const isAdmin = useMemo(
    () => userRoles.includes("admin") || userRoles.includes("super_admin"),
    [userRoles]
  );

  const visibleItems = useMemo(() => {
    // While auth/company are still loading, show the full menu (routes are still protected)
    if (!currentCompany || authLoading || userRoles.length === 0) return items;

    // Super admins see everything
    if (isSuperAdmin) return items;

    return items.filter((item) => hasPagePermission(currentCompany.id, item.menuId));
  }, [items, currentCompany?.id, authLoading, userRoles.length, isSuperAdmin, hasPagePermission]);

  const handleLogout = async () => {
    sessionStorage.removeItem('viewing_company_id');
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
      navigate("/auth");
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error("Failed to logout");
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="px-4 py-6 flex items-center gap-3">
          <h1 
            className={`font-bold transition-opacity ${isCollapsed ? 'opacity-0 text-xs' : 'opacity-100 text-xl'}`}
          >
            The Nest
          </h1>
        </div>
        
        {isSuperAdmin && (
          isCollapsed ? (
            <div className="px-2 pb-4">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="w-full h-10 flex items-center justify-center rounded-md hover:bg-sidebar-accent">
                    <Building2 className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-60 bg-popover text-popover-foreground border z-50" side="right">
                  <div className="space-y-2">
                    <p className="text-sm font-medium mb-2">Switch Company</p>
                    {availableCompanies.map(company => (
                      <button
                        key={company.id}
                        onClick={() => switchCompany(company.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          currentCompany?.id === company.id 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {company.name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="px-4 pb-4">
              <Select 
                value={currentCompany?.id} 
                onValueChange={switchCompany}
                disabled={companyLoading}
              >
                <SelectTrigger className="w-full">
                  <Building2 className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select company..." />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border z-50">
                  {availableCompanies.map(company => (
                    <SelectItem 
                      key={company.id} 
                      value={company.id}
                      className="cursor-pointer"
                    >
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        )}
        
        <div className="pb-4">
          <div className={`transition-all ${isCollapsed ? 'px-2 scale-75' : 'px-4'}`}>
            <SeasonSelector />
          </div>
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    {item.external ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-sidebar-accent/50 flex items-center gap-2"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    ) : (
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive }) =>
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/evaluation-questions"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <ClipboardList className="h-4 w-4" />
                      <span>Evaluation Questions</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/role-permissions"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Settings className="h-4 w-4" />
                      <span>Role Permissions</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/division-permissions"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Settings className="h-4 w-4" />
                      <span>Division Permissions</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/specialist-sport-assignments"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <Trophy className="h-4 w-4" />
                      <span>Specialist Sport Assignments</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/user-approvals"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <ClipboardList className="h-4 w-4" />
                      <span>User Approvals</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
