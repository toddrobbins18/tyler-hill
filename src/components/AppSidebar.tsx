import { Home, Users, Truck, FileText, Mail, Award, UserCog, Shield, Pill, Utensils, ClipboardList, ClipboardEdit, Settings, CloudRain, AlertTriangle, Calendar, Trophy, Palmtree, BookOpen, Building2, LogOut, BarChart3 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
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
  const baseItems = [
    { title: companySlug === 'timber-lake-west' ? "Athletics" : "Sports Calendar", url: "/athletics", icon: Trophy, menuId: "sports-calendar" },
    { title: "Camper", url: "/roster", icon: Users, menuId: "roster" },
    { title: companySlug === 'timber-lake-west' ? "Tiger Times" : "Dashboard", url: "/", icon: Home, menuId: "dashboard" },
    { title: "Master Calendar", url: "/calendar", icon: Calendar, menuId: "calendar" },
    { title: "Menu", url: "/menu", icon: Utensils, menuId: "menu" },
    { title: "Rainy Day Schedule", url: "/rainy-day", icon: CloudRain, menuId: "rainy-day" },
    { title: "Special Events & Evening Activities", url: "/special-events", icon: Calendar, menuId: "special-events" },
    { title: "Staff", url: "/staff", icon: UserCog, menuId: "staff" },
    { title: "Tutoring & Therapy", url: "/tutoring-therapy", icon: BookOpen, menuId: "tutoring-therapy" },
  ];

  // Add items ONLY for companies OTHER THAN Timber Lake Camp
  if (companySlug !== 'timber-lake-camp') {
    baseItems.push(
      { title: "Activities & Field Trips", url: "/activities", icon: Palmtree, menuId: "activities" },
      { title: "Messages", url: "/messages", icon: Mail, menuId: "messages" },
      { title: "Special Meals", url: "/special-meals", icon: Utensils, menuId: "special-meals" },
      { title: "Transportation", url: "/transportation", icon: Truck, menuId: "transportation" }
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

  // Add Daily Wolf items ONLY for Timber Lake West
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

  return baseItems.sort((a, b) => a.title.localeCompare(b.title));
};

export function AppSidebar() {
  const navigate = useNavigate();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isAdmin, setIsAdmin] = useState(false);
  const { userRole, canAccessPage, loading: permissionsLoading } = usePermissions();
  const { currentCompany, availableCompanies, switchCompany, loading: companyLoading, isSuperAdmin } = useCompany();
  
  const items = getMenuItems(currentCompany?.slug);
  const [visibleItems, setVisibleItems] = useState<typeof items>([]);

  useEffect(() => {
    checkAdminStatus();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!permissionsLoading && userRole && currentCompany) {
      filterMenuItems();
    }
  }, [userRole, permissionsLoading, currentCompany, items]);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!roles);
  };

  const filterMenuItems = async () => {
    const filtered = [];
    for (const item of items) {
      const hasAccess = await canAccessPage(item.menuId);
      if (hasAccess) {
        filtered.push(item);
      }
    }
    setVisibleItems(filtered);
  };

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
        
        {/* Debug Info */}
        {!isCollapsed && (
          <div className="px-4 pb-2 text-xs text-muted-foreground space-y-1">
            <div>Super Admin: {isSuperAdmin ? '✅' : '❌'}</div>
            <div>Companies: {availableCompanies.length}</div>
            <div>Current: {currentCompany?.name || 'None'}</div>
          </div>
        )}
        
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
