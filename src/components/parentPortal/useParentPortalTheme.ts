import { useEffect, useRef } from "react";
import {
  applyParentPortalTheme,
  resolveParentPortalThemeColor,
} from "@/lib/parentPortalTheme";

export function useParentPortalTheme(
  themeColor?: string | null,
  companySlug?: string | null,
) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const color = resolveParentPortalThemeColor(themeColor, companySlug);
    applyParentPortalTheme(color, rootRef.current);
  }, [themeColor, companySlug]);

  return rootRef;
}
