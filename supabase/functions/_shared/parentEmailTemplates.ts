import type { ParentEmailTemplateKey } from "./parentReminderLayout.ts";

type TemplateDef = {
  subject: string;
  body: string;
};

export const PARENT_EMAIL_TEMPLATES: Record<ParentEmailTemplateKey, TemplateDef> = {
  sunscreen: {
    subject: "Please send more sunscreen for {camperName}",
    body: `Hi,

We wanted to let you know that {camperName} could use more sunscreen at camp. Please see the attached reminder.

Thank you,
{campName}`,
  },
  extra_clothes: {
    subject: "Please send an extra set of clothes for {camperName}",
    body: `Hi,

{camperName} could use an extra set of clothes at camp. Please see the attached reminder.

Thank you,
{campName}`,
  },
  water_bottle: {
    subject: "Please send a water bottle for {camperName}",
    body: `Hi,

{camperName} could use a water bottle at camp. Please see the attached reminder.

Thank you,
{campName}`,
  },
  rain_gear: {
    subject: "Please send rain gear for {camperName}",
    body: `Hi,

{camperName} could use rain gear at camp. Please see the attached reminder.

Thank you,
{campName}`,
  },
};

export function renderParentEmailTemplate(
  key: ParentEmailTemplateKey,
  vars: { camperName: string; campName: string },
): { subject: string; body: string } | null {
  const template = PARENT_EMAIL_TEMPLATES[key];
  if (!template) return null;
  const replace = (s: string) =>
    s.replace(/\{camperName\}/g, vars.camperName).replace(/\{campName\}/g, vars.campName);
  return { subject: replace(template.subject), body: replace(template.body) };
}

export function isParentEmailTemplateKey(value: string): value is ParentEmailTemplateKey {
  return value in PARENT_EMAIL_TEMPLATES;
}
