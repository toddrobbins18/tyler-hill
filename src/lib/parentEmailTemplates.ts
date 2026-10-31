import type { LucideIcon } from "lucide-react";
import { Glasses, Shirt, Sun } from "lucide-react";

/** Todd: sunscreen, goggles, extra clothing only (no lunch/towel/water/rain). */
export type ParentEmailTemplateKey = "sunscreen" | "extra_clothes" | "goggles";

export type ParentEmailTemplateOption = {
  key: ParentEmailTemplateKey;
  label: string;
  icon: LucideIcon;
};

export const PARENT_EMAIL_TEMPLATE_OPTIONS: ParentEmailTemplateOption[] = [
  { key: "sunscreen", label: "More sunscreen", icon: Sun },
  { key: "goggles", label: "Goggles", icon: Glasses },
  { key: "extra_clothes", label: "Extra clothes", icon: Shirt },
];
