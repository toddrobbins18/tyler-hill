/** Keep in sync with src/lib/parentReminderLayout.ts */
export type ParentEmailTemplateKey =
  | "sunscreen"
  | "extra_clothes"
  | "water_bottle"
  | "rain_gear";

export const PARENT_REMINDER_WIDTH = 1854;
export const PARENT_REMINDER_HEIGHT = 2400;

export type ParentReminderNameLayout = {
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

export const PARENT_REMINDER_ASSET: Record<
  ParentEmailTemplateKey,
  { attachmentName: string; embedKey: ParentEmailTemplateKey }
> = {
  sunscreen: { attachmentName: "nsdc_sunscreen_reminder.jpg", embedKey: "sunscreen" },
  extra_clothes: { attachmentName: "nsdc_extra_clothing_reminder.jpg", embedKey: "extra_clothes" },
  water_bottle: { attachmentName: "nsdc_water_bottle_reminder.jpg", embedKey: "water_bottle" },
  rain_gear: { attachmentName: "nsdc_rain_gear_reminder.jpg", embedKey: "rain_gear" },
};
