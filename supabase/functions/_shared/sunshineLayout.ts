/** Todd NSDC template 682×1024 — keep in sync with src/lib/sunshineLayout.ts */

export const SUNSHINE_TEMPLATE_WIDTH = 682;
export const SUNSHINE_TEMPLATE_HEIGHT = 1024;

export type SunshineLineBlock = {
  x: number;
  firstBaseline: number;
  lineGap: number;
  fontSize: number;
  maxLines: number;
};

export const SUNSHINE_LAYOUT = {
  camper: { x: 228, baseline: 270, fontSize: 50 },
  activities: { x: 62, firstBaseline: 435, lineGap: 30, fontSize: 16, maxLines: 4 },
  sports: { x: 368, firstBaseline: 435, lineGap: 30, fontSize: 16, maxLines: 4 },
  lunch: { x: 62, firstBaseline: 660, lineGap: 30, fontSize: 16, maxLines: 3 },
  bmCheck: { x: 290, baseline: 790, fontSize: 20 },
  napCheck: { x: 620, baseline: 790, fontSize: 20 },
} as const;

export function baselinesFor(block: SunshineLineBlock): number[] {
  return Array.from({ length: block.maxLines }, (_, i) => block.firstBaseline + i * block.lineGap);
}

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
