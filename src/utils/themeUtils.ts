// Convert hex color to HSL format for CSS variables
export function hexToHSL(hex: string): string {
  const normalized = normalizeHex(hex);

  // Convert to RGB
  const r = parseInt(normalized.substring(0, 2), 16) / 255;
  const g = parseInt(normalized.substring(2, 4), 16) / 255;
  const b = parseInt(normalized.substring(4, 6), 16) / 255;

  // Calculate HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

function normalizeHex(hex: string): string {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]+$/.test(h)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return h;
}

// Parse HSL string back to numbers
function parseHSL(hsl: string): { h: number; s: number; l: number } {
  const matches = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!matches) throw new Error('Invalid HSL format');
  return {
    h: parseInt(matches[1]),
    s: parseInt(matches[2]),
    l: parseInt(matches[3]),
  };
}

/**
 * Derive sidebar background lightness from the brand `theme_color` stored in Supabase.
 * We darken by a fixed step (matching legacy behavior) but clamp the minimum so deep reds
 * (Timber Lake West) do not hit 0% and read as pure black.
 * Upper cap keeps very pale brand colors from producing washed-out sidebars.
 */
function sidebarBackgroundLightness(brandLightness: number): number {
  return Math.min(30, Math.max(14, brandLightness - 40));
}

function sidebarAccentLightness(backgroundLightness: number, brandLightness: number): number {
  return Math.min(42, Math.max(backgroundLightness + 8, brandLightness - 32));
}

/** HSL string for sidebar background, same formula as mobile `sidebarBackgroundHexFromBrandHex`. */
export function computeSidebarBackgroundHSL(brandHex: string): string {
  const hsl = hexToHSL(brandHex);
  const { h, s, l } = parseHSL(hsl);
  const bgL = sidebarBackgroundLightness(l);
  return `${h} ${s}% ${bgL}%`;
}

export function computeSidebarAccentHSL(brandHex: string): string {
  const hsl = hexToHSL(brandHex);
  const { h, s, l } = parseHSL(hsl);
  const bgL = sidebarBackgroundLightness(l);
  const accentL = sidebarAccentLightness(bgL, l);
  return `${h} ${s}% ${accentL}%`;
}

/** Matches `companies.slug` / mobile `CAMP_SLUG.TIMBER_LAKE_CAMP`. */
const TIMBER_LAKE_CAMP_SLUG = 'timber-lake-camp';

export type ApplyThemeColorOptions = {
  companySlug?: string | null;
};

// Apply theme color to CSS variables (`companies.theme_color` from Supabase)
export function applyThemeColor(color: string, options?: ApplyThemeColorOptions) {
  let hsl: string;
  let sidebarBg: string;
  let sidebarAccent: string;

  try {
    hsl = hexToHSL(color);
    if (options?.companySlug === TIMBER_LAKE_CAMP_SLUG) {
      // Pitch-black drawer (see mobile `TIMBER_LAKE_CAMP.drawerBackground`); brand stays `--primary`.
      sidebarBg = '0 0% 0%';
      sidebarAccent = '0 0% 14%';
    } else {
      sidebarBg = computeSidebarBackgroundHSL(color);
      sidebarAccent = computeSidebarAccentHSL(color);
    }
  } catch {
    console.warn('applyThemeColor: invalid hex, skipping', color);
    return;
  }

  const root = document.documentElement;

  root.style.removeProperty('--primary');
  root.style.removeProperty('--ring');
  root.style.removeProperty('--sidebar-background');
  root.style.removeProperty('--sidebar-accent');
  root.style.removeProperty('--sidebar-border');
  root.style.removeProperty('--sidebar-primary');
  root.style.removeProperty('--sidebar-ring');

  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-background', sidebarBg);
  root.style.setProperty('--sidebar-accent', sidebarAccent);
  root.style.setProperty('--sidebar-border', sidebarAccent);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);
}
