import type { ParentEmailTemplateKey } from "@/lib/parentEmailTemplates";

/** NSDC parent reminder graphics (1854×2400). Keep in sync with supabase/functions/_shared/parentReminderLayout.ts */
export const PARENT_REMINDER_WIDTH = 1854;
export const PARENT_REMINDER_HEIGHT = 2400;

export type ParentReminderNameLayout = {
  /** Name text box (white pill after “Hi”) */
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
};

export const PARENT_REMINDER_NAME: ParentReminderNameLayout = {
  x: 448,
  y: 708,
  width: 430,
  height: 58,
  fontSize: 36,
  color: "#1c4a7a",
};

/** Public asset file under /parent-reminders/ */
export const PARENT_REMINDER_ASSET: Record<
  ParentEmailTemplateKey,
  { file: string; attachmentName: string }
> = {
  sunscreen: { file: "sunscreen.jpg", attachmentName: "nsdc_sunscreen_reminder.jpg" },
  extra_clothes: { file: "extra_clothing.jpg", attachmentName: "nsdc_extra_clothing_reminder.jpg" },
  goggles: { file: "goggles.jpg", attachmentName: "nsdc_goggles_reminder.jpg" },
};

export function parentReminderPublicUrl(templateKey: ParentEmailTemplateKey): string {
  const file = PARENT_REMINDER_ASSET[templateKey].file;
  return `/parent-reminders/${file}`;
}

export type PixelRect = { x: number; y: number; width: number; height: number };

function isNearWhite(r: number, g: number, b: number, threshold: number): boolean {
  return r >= threshold && g >= threshold && b >= threshold;
}

/** Tight box around non-white pixels so reminder JPEGs lose the white frame. */
export function cropNearWhiteBounds(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold = 248,
): PixelRect {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isNearWhite(data[i] ?? 255, data[i + 1] ?? 255, data[i + 2] ?? 255, threshold)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return { x: 0, y: 0, width, height };
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function scaleReminderNameLayout(
  layout: ParentReminderNameLayout,
  crop: PixelRect,
  sourceWidth: number,
  sourceHeight: number,
): ParentReminderNameLayout {
  if (crop.width <= 0 || crop.height <= 0) return layout;
  if (crop.x === 0 && crop.y === 0 && crop.width === sourceWidth && crop.height === sourceHeight) {
    return layout;
  }
  const sx = sourceWidth / crop.width;
  const sy = sourceHeight / crop.height;
  return {
    x: (layout.x - crop.x) * sx,
    y: (layout.y - crop.y) * sy,
    width: layout.width * sx,
    height: layout.height * sy,
    fontSize: Math.max(18, layout.fontSize * Math.min(sx, sy)),
    color: layout.color,
  };
}
