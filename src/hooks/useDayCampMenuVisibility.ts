import { useMemo } from "react";
import type { DayCampMenuItem } from "@/lib/dayCampMenu";

export function useDayCampMenuVisibility(
  items: DayCampMenuItem[],
  options: {
    currentCompany: { id: string } | null;
    authLoading: boolean;
    userRolesLength: number;
    isSuperAdmin: boolean;
    hasPagePermission: (companyId: string, menuItem: string) => boolean;
  },
) {
  const { currentCompany, authLoading, userRolesLength, isSuperAdmin, hasPagePermission } = options;

  return useMemo(() => {
    if (!currentCompany || authLoading || userRolesLength === 0) return items;
    if (isSuperAdmin) return items;
    return items.filter((item) => hasPagePermission(currentCompany.id, item.menuId));
  }, [items, currentCompany?.id, authLoading, userRolesLength, isSuperAdmin, hasPagePermission]);
}
