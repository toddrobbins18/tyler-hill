import { Home, Users, Truck, FileText, Mail, Award, UserCog, Shield, Pill, Utensils, ClipboardList, Settings, CloudRain, AlertTriangle, Calendar, Trophy, Palmtree, BookOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Activities & Field Trips", url: "/activities", icon: Palmtree, menuId: "activities" },
  { title: "Awards", url: "/awards", icon: Award, menuId: "awards" },
  { title: "Camper", url: "/roster", icon: Users, menuId: "roster" },
  { title: "Dashboard", url: "/", icon: Home, menuId: "dashboard" },
  { title: "Franko Sheet", url: "/notes", icon: Truck, menuId: "notes" },
  { title: "Incident Reports", url: "/incidents", icon: AlertTriangle, menuId: "incidents" },
  { title: "Master Calendar", url: "/calendar", icon: Calendar, menuId: "calendar" },
  { title: "Menu", url: "/menu", icon: Utensils, menuId: "menu" },
  { title: "Messages", url: "/messages", icon: Mail, menuId: "messages" },
  { title: "Nurse Dashboard", url: "/nurse", icon: Pill, menuId: "nurse" },
  { title: "Rainy Day Schedule", url: "/rainy-day", icon: CloudRain, menuId: "rainy-day" },
  { title: "Special Events & Evening Activities", url: "/special-events", icon: Calendar, menuId: "special-events" },
  { title: "Special Meals", url: "/special-meals", icon: Utensils, menuId: "special-meals" },
  { title: "Sports Academy", url: "/sports-academy", icon: Trophy, menuId: "sports-academy" },
  { title: "Sports Calendar", url: "/sports-calendar", icon: Trophy, menuId: "sports-calendar" },
  { title: "Staff", url: "/staff", icon: UserCog, menuId: "staff" },
  { title: "Transportation", url: "/transportation", icon: Truck, menuId: "transportation" },
  { title: "Tutoring & Therapy", url: "/tutoring-therapy", icon: BookOpen, menuId: "tutoring-therapy" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isAdmin, setIsAdmin] = useState(false);
  const [visibleItems, setVisibleItems] = useState(items);
  const { userRole, canAccessPage, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    checkAdminStatus();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!permissionsLoading && userRole) {
      filterMenuItems();
    }
  }, [userRole, permissionsLoading]);

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

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="px-4 py-6">
          <h1 className={`font-bold transition-opacity ${isCollapsed ? 'opacity-0 text-xs' : 'opacity-100 text-xl'}`}>
            The Nest
          </h1>
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
    </Sidebar>
  );
}
