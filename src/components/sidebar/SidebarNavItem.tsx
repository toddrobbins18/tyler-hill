import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { isSidebarNavActive } from "@/lib/sidebarNavActive";

type Props = {
  to: string;
  children: ReactNode;
  /** NavLink `end` — defaults to true only for home `/`. */
  end?: boolean;
};

export function SidebarNavItem({ to, children, end }: Props) {
  const { pathname } = useLocation();
  const active = isSidebarNavActive(pathname, to);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <NavLink to={to} end={end ?? to === "/"}>
          {children}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
