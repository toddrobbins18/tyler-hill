import { hexToHSL } from "@/utils/themeUtils";
import { CAMP_SLUG } from "@/lib/camps";

/** North Shore Day Camp — matches `companies.theme_color` in Supabase. */
export const NORTH_SHORE_THEME_COLOR = "#1565C0";

export const DEFAULT_PARENT_PORTAL_THEME = NORTH_SHORE_THEME_COLOR;

function parseHSL(hsl: string): { h: number; s: number; l: number } {
  const matches = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!matches) throw new Error(`Invalid HSL: ${hsl}`);
  return {
    h: parseInt(matches[1], 10),
    s: parseInt(matches[2], 10),
    l: parseInt(matches[3], 10),
  };
}

export function resolveParentPortalThemeColor(
  themeColor?: string | null,
  companySlug?: string | null,
): string {
  const trimmed = themeColor?.trim();
  if (trimmed && /^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (companySlug === CAMP_SLUG.NORTH_SHORE_DAY_CAMP) return NORTH_SHORE_THEME_COLOR;
  return DEFAULT_PARENT_PORTAL_THEME;
}

/** Set CSS variables on a `.parent-portal` root from camp brand hex. */
export function applyParentPortalTheme(themeColor: string, root?: HTMLElement | null) {
  const target =
    root ??
    (document.querySelector(".parent-portal") as HTMLElement | null) ??
    document.documentElement;

  let hsl: string;
  try {
    hsl = hexToHSL(themeColor);
  } catch {
    hsl = hexToHSL(DEFAULT_PARENT_PORTAL_THEME);
  }

  const { h, s, l } = parseHSL(hsl);
  const brandDarkL = Math.max(26, l - 12);
  const brandHoverL = Math.max(32, l - 6);
  const softS = Math.min(48, Math.round(s * 0.45));

  target.style.setProperty("--pp-brand", hsl);
  target.style.setProperty("--pp-brand-dark", `${h} ${Math.round(s * 0.95)}% ${brandDarkL}%`);
  target.style.setProperty("--pp-brand-hover", `${h} ${s}% ${brandHoverL}%`);
  target.style.setProperty("--pp-brand-soft", `${h} ${softS}% 95%`);
  target.style.setProperty("--pp-brand-muted", `${h} ${Math.round(softS * 0.7)}% 90%`);
  target.style.setProperty("--pp-brand-subtle", `${h} ${Math.round(softS * 0.5)}% 97%`);

  /* Neutral surfaces — #f8fafc page, #ffffff cards, slate text */
  target.style.setProperty("--pp-bg", "210 40% 98%");
  target.style.setProperty("--pp-bg-elevated", "0 0% 100%");
  target.style.setProperty("--pp-text", "222 47% 11%");
  target.style.setProperty("--pp-text-muted", "215 16% 47%");
  target.style.setProperty("--pp-text-subtle", "215 14% 57%");
  target.style.setProperty("--pp-border", "214 32% 91%");
  target.style.setProperty("--pp-border-strong", "214 25% 84%");
}
