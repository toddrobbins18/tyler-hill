// Convert hex color to HSL format for CSS variables
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Calculate HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
}

// Parse HSL string back to numbers
function parseHSL(hsl: string): { h: number; s: number; l: number } {
  const matches = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!matches) throw new Error('Invalid HSL format');
  return {
    h: parseInt(matches[1]),
    s: parseInt(matches[2]),
    l: parseInt(matches[3])
  };
}

// Create a darker version of the color for sidebar background
function darkenColor(hsl: string, amount: number): string {
  const { h, s, l } = parseHSL(hsl);
  const newL = Math.max(0, l - amount); // Reduce lightness, min 0
  return `${h} ${s}% ${newL}%`;
}

// Apply theme color to CSS variables
export function applyThemeColor(color: string) {
  console.log('🎨 Applying theme color:', color);
  
  const hsl = hexToHSL(color);
  console.log('🎨 Converted to HSL:', hsl);
  
  const root = document.documentElement;
  
  // Calculate sidebar colors - darker versions for background
  const sidebarBg = darkenColor(hsl, 40); // Very dark for background
  const sidebarAccent = darkenColor(hsl, 32); // Slightly lighter for hover
  
  console.log('🎨 Sidebar BG:', sidebarBg);
  console.log('🎨 Sidebar Accent:', sidebarAccent);
  
  // Force remove and re-add to ensure update
  root.style.removeProperty('--primary');
  root.style.removeProperty('--ring');
  root.style.removeProperty('--sidebar-background');
  root.style.removeProperty('--sidebar-accent');
  root.style.removeProperty('--sidebar-border');
  root.style.removeProperty('--sidebar-primary');
  root.style.removeProperty('--sidebar-ring');
  
  // Apply all theme colors
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);
  root.style.setProperty('--sidebar-background', sidebarBg);
  root.style.setProperty('--sidebar-accent', sidebarAccent);
  root.style.setProperty('--sidebar-border', sidebarAccent);
  root.style.setProperty('--sidebar-primary', hsl);
  root.style.setProperty('--sidebar-ring', hsl);
  
  console.log('✅ Theme applied successfully');
}
