import type { LucideIcon } from "lucide-react";
import { CloudRain, Droplets, Shirt, Sun, Utensils, Waves } from "lucide-react";

export type ParentEmailTemplateKey =
  | "sunscreen"
  | "extra_clothes"
  | "towel"
  | "water_bottle"
  | "lunch"
  | "rain_gear";

export type ParentEmailTemplateOption = {
  key: ParentEmailTemplateKey;
  label: string;
  icon: LucideIcon;
};

export const PARENT_EMAIL_TEMPLATE_OPTIONS: ParentEmailTemplateOption[] = [
  { key: "sunscreen", label: "More sunscreen", icon: Sun },
  { key: "extra_clothes", label: "Extra clothes", icon: Shirt },
  { key: "towel", label: "Towel", icon: Waves },
  { key: "water_bottle", label: "Water bottle", icon: Droplets },
  { key: "lunch", label: "Pack lunch", icon: Utensils },
  { key: "rain_gear", label: "Rain gear", icon: CloudRain },
];
