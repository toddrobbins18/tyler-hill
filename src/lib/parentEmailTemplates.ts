import type { LucideIcon } from "lucide-react";
import { CloudRain, Droplets, Shirt, Sun } from "lucide-react";

/** Todd: four NSDC reminder graphics only (no towel / pack lunch). */
export type ParentEmailTemplateKey =
  | "sunscreen"
  | "extra_clothes"
  | "water_bottle"
  | "rain_gear";

export type ParentEmailTemplateOption = {
  key: ParentEmailTemplateKey;
  label: string;
  icon: LucideIcon;
};

export const PARENT_EMAIL_TEMPLATE_OPTIONS: ParentEmailTemplateOption[] = [
  { key: "sunscreen", label: "More sunscreen", icon: Sun },
  { key: "extra_clothes", label: "Extra clothes", icon: Shirt },
  { key: "water_bottle", label: "Water bottle", icon: Droplets },
  { key: "rain_gear", label: "Rain gear", icon: CloudRain },
];
