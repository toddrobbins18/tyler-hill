import { NavLink } from "react-router-dom";
import type { DayCampMenuItem } from "@/lib/dayCampMenu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type Props = {
  items: DayCampMenuItem[];
};

export function DayCampSidebarMenuList({ items }: Props) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.menuId}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.url === "/"}
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
  );
}
