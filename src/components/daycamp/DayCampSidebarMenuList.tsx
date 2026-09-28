import type { DayCampMenuItem } from "@/lib/dayCampMenu";
import { SidebarMenu } from "@/components/ui/sidebar";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";

type Props = {
  items: DayCampMenuItem[];
};

export function DayCampSidebarMenuList({ items }: Props) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarNavItem key={item.menuId} to={item.url}>
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </SidebarNavItem>
      ))}
    </SidebarMenu>
  );
}
