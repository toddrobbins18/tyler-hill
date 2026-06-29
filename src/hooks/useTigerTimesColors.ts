import { useState, useEffect } from "react";

const TIGER_TIMES_DEFAULTS: Record<string, string> = {
  "Laundry": "#3b82f6",
  "Phone Calls": "#ef4444",
  "Movie / Entertainment": "#eab308",
  "Staff Days Off": "#7dd3fc",
  "OD Notes": "#ff69b4",
};

function mergeTigerTimesColors(stored: Record<string, string>): Record<string, string> {
  const merged = { ...TIGER_TIMES_DEFAULTS, ...stored };
  if (stored["Outside Events"] && !stored["Movie / Entertainment"]) {
    merged["Movie / Entertainment"] = stored["Outside Events"];
  }
  return merged;
}

export function useTigerTimesColors() {
  const [colors, setColors] = useState<Record<string, string>>(TIGER_TIMES_DEFAULTS);

  useEffect(() => {
    const stored = localStorage.getItem("calendar-colors-tiger-times");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setColors(mergeTigerTimesColors(parsed));
      } catch {
        // ignore
      }
    }

    // Listen for storage changes from the settings component
    const handler = () => {
      const s = localStorage.getItem("calendar-colors-tiger-times");
      if (s) {
        try { setColors(mergeTigerTimesColors(JSON.parse(s))); } catch {}
      } else {
        setColors(TIGER_TIMES_DEFAULTS);
      }
    };
    window.addEventListener("storage", handler);
    // Also listen for custom event for same-tab updates
    window.addEventListener("tiger-times-colors-updated", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("tiger-times-colors-updated", handler);
    };
  }, []);

  return colors;
}

export { TIGER_TIMES_DEFAULTS };
