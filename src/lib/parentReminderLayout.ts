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
  water_bottle: { file: "water_bottle.jpg", attachmentName: "nsdc_water_bottle_reminder.jpg" },
  rain_gear: { file: "rain_gear.jpg", attachmentName: "nsdc_rain_gear_reminder.jpg" },
};

export function parentReminderPublicUrl(templateKey: ParentEmailTemplateKey): string {
  const file = PARENT_REMINDER_ASSET[templateKey].file;
  return `/parent-reminders/${file}`;
}
