import { Home, Users, Truck, FileText, Mail, Award, UserCog, Shield, Pill, Utensils, ClipboardList, ClipboardEdit, Settings, CloudRain, AlertTriangle, Calendar, Trophy, Palmtree, BookOpen, Building2, LogOut, BarChart3, ListChecks, ClipboardCheck, Stethoscope, ExternalLink, ClipboardPen, CreditCard, ChevronDown, Clock } from "lucide-react";
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
import { isDayCampCompany } from "@/lib/camps";
import { getDayCampUnifiedSidebarItems } from "@/lib/dayCampMenu";
import { getOvernightMenuItems } from "@/lib/overnightMenu";
import { DayCampSidebarMenuList } from "@/components/daycamp/DayCampSidebarMenuList";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";
import { useDayCampMenuVisibility } from "@/hooks/useDayCampMenuVisibility";

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

  const isDayCamp = isDayCampCompany(currentCompany);

  const dayCampUnifiedItems = useMemo(
    () => getDayCampUnifiedSidebarItems(currentCompany),
    [currentCompany?.slug, currentCompany?.camp_type],
  );

  const overnightItems = useMemo(
    () => getOvernightMenuItems(currentCompany),
    [currentCompany?.slug, currentCompany?.name, currentCompany?.camp_type],
  );

  const items = isDayCamp ? dayCampUnifiedItems : overnightItems;

  const permissionOptions = {
    currentCompany,
    authLoading,
    userRolesLength: userRoles.length,
    isSuperAdmin,
    hasPagePermission,
  };

  const visibleItems = useDayCampMenuVisibility(items, permissionOptions);

  const showAdministration = useMemo(() => {
    if (!currentCompany?.id) return false;
    if (isSuperAdmin) return true;
    const adminMenuItems = [
      "admin",
      "evaluation-questions",
      "role-permissions",
      "division-permissions",
      "specialist-sport-assignments",
      "user-approvals",
    ];
    return adminMenuItems.some((item) => hasPagePermission(currentCompany.id, item));
  }, [currentCompany?.id, isSuperAdmin, hasPagePermission]);

  const showCampSwitcher = availableCompanies.length > 1;

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
        
        {showCampSwitcher && (
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
                <SelectTrigger className="w-full bg-background text-foreground">
                  <Building2 className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
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
          {!isDayCamp ? <SidebarGroupLabel>Main Menu</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            {isDayCamp ? (
              <DayCampSidebarMenuList items={visibleItems} />
            ) : (
            <SidebarMenu>
              {visibleItems.map((item) =>
                item.external ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  <SidebarNavItem key={item.title} to={item.url}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarNavItem>
                ),
              )}
            </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdministration && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarNavItem to="/admin">
                  <Shield className="h-4 w-4" />
                  <span>Admin Panel</span>
                </SidebarNavItem>
                <SidebarNavItem to="/evaluation-questions">
                  <ClipboardList className="h-4 w-4" />
                  <span>Evaluation Questions</span>
                </SidebarNavItem>
                <SidebarNavItem to="/role-permissions">
                  <Settings className="h-4 w-4" />
                  <span>Role Permissions</span>
                </SidebarNavItem>
                <SidebarNavItem to="/division-permissions">
                  <Settings className="h-4 w-4" />
                  <span>Division Permissions</span>
                </SidebarNavItem>
                <SidebarNavItem to="/specialist-sport-assignments">
                  <Trophy className="h-4 w-4" />
                  <span>Specialist Sport Assignments</span>
                </SidebarNavItem>
                <SidebarNavItem to="/user-approvals">
                  <ClipboardList className="h-4 w-4" />
                  <span>User Approvals</span>
                </SidebarNavItem>
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
