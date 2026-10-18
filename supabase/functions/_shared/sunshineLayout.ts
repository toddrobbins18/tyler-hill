/** Todd NSDC template 682×1024 — keep in sync with src/lib/sunshineLayout.ts */

export const SUNSHINE_TEMPLATE_WIDTH = 682;
export const SUNSHINE_TEMPLATE_HEIGHT = 1024;

export const SUNSHINE_LAYOUT = {
  camper: { x: 228, baseline: 256, fontSize: 22 },
  activities: { x: 62, baselines: [322, 352, 382, 412] as number[], fontSize: 16, maxLines: 4 },
  sports: { x: 368, baselines: [322, 352, 382, 412] as number[], fontSize: 16, maxLines: 4 },
  lunch: { x: 62, baselines: [522, 552, 582] as number[], fontSize: 16, maxLines: 3 },
  bmCheck: { x: 333, baseline: 668, fontSize: 20 },
  napCheck: { x: 652, baseline: 668, fontSize: 20 },
} as const;

export function fitSheetLines(items: string[], maxLines: number): string[] {
  if (!items.length) return [];
  if (items.length <= maxLines) return items;
  const head = items.slice(0, maxLines - 1);
  head.push(items.slice(maxLines - 1).join(", "));
  return head;
}

export function truncateField(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
