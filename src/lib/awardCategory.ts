/**
 * `awards.category` may store JSON from AddAwardDialog (weekly starfish, weekly camper award, etc.).
 */
export type ParsedAwardCategory = {
  weekly_starfish_values?: string[];
  weekly_camper_award?: string;
  year_end_starfish_values?: string[];
};

export function tryParseAwardCategory(raw: string | null | undefined): ParsedAwardCategory | null {
  if (raw == null || raw === "") return null;
  const t = String(raw).trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t);
    if (o && typeof o === "object" && !Array.isArray(o)) return o as ParsedAwardCategory;
  } catch {
    return null;
  }
  return null;
}

/** Human-readable line for inline / mobile (no JSX). */
export function formatAwardCategoryPlainText(raw: string | null | undefined): string {
  const parsed = tryParseAwardCategory(raw);
  if (!parsed) return (raw ?? "").trim();
  const parts: string[] = [];
  if (parsed.weekly_starfish_values?.length) {
    parts.push(`Starfish: ${parsed.weekly_starfish_values.join(", ")}`);
  }
  if (parsed.weekly_camper_award) {
    parts.push(parsed.weekly_camper_award);
  }
  if (parsed.year_end_starfish_values?.length) {
    parts.push(`Year-end Starfish: ${parsed.year_end_starfish_values.join(", ")}`);
  }
  return parts.join(" · ");
}
