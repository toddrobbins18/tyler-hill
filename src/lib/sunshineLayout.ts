/** Todd NSDC template 682×1024 — text baselines (template scan + visual tune). */

export const SUNSHINE_TEMPLATE_WIDTH = 682;
export const SUNSHINE_TEMPLATE_HEIGHT = 1024;

export const SUNSHINE_LAYOUT = {
  camper: { x: 228, baseline: 270, fontSize: 50 },
  activities: { x: 62, baselines: [435, 352, 382, 412] as number[], fontSize: 16, maxLines: 4 },
  sports: { x: 368, baselines: [435, 352, 382, 412] as number[], fontSize: 16, maxLines: 4 },
  lunch: { x: 62, baselines: [660, 552, 582] as number[], fontSize: 16, maxLines: 3 },
  bmCheck: { x:290, baseline: 790, fontSize: 20 },
  napCheck: { x: 620, baseline: 790, fontSize: 20 },
} as const;

export function fitSheetLines(items: string[], maxLines: number): string[] {
  if (!items.length) return [];
  if (items.length <= maxLines) return items;
  const head = items.slice(0, maxLines - 1);
  head.push(items.slice(maxLines - 1).join(", "));
  return head;
}
