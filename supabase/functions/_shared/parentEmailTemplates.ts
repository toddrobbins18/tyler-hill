export type ParentEmailTemplateKey =
  | "sunscreen"
  | "extra_clothes"
  | "towel"
  | "water_bottle"
  | "lunch"
  | "rain_gear";

type TemplateDef = {
  subject: string;
  body: string;
};

export const PARENT_EMAIL_TEMPLATES: Record<ParentEmailTemplateKey, TemplateDef> = {
  sunscreen: {
    subject: "Please send more sunscreen for {camperName}",
    body: `Hi,

We wanted to let you know that {camperName} could use more sunscreen at camp. Please send a labeled bottle with your camper tomorrow if possible.

Thank you,
{campName}`,
  },
  extra_clothes: {
    subject: "Please send an extra set of clothes for {camperName}",
    body: `Hi,

{camperName} could use an extra set of clothes at camp (shirt, shorts, underwear, and socks). Please send a labeled bag with your camper tomorrow if possible.

Thank you,
{campName}`,
  },
  towel: {
    subject: "Please send a towel for {camperName}",
    body: `Hi,

{camperName} could use a towel at camp. Please send one labeled with your camper's name tomorrow if possible.

Thank you,
{campName}`,
  },
  water_bottle: {
    subject: "Please send a water bottle for {camperName}",
    body: `Hi,

{camperName} could use a water bottle at camp. Please send a labeled bottle with your camper tomorrow if possible.

Thank you,
{campName}`,
  },
  lunch: {
    subject: "Please pack a lunch for {camperName}",
    body: `Hi,

Please pack a lunch for {camperName} to bring to camp tomorrow.

Thank you,
{campName}`,
  },
  rain_gear: {
    subject: "Please send rain gear for {camperName}",
    body: `Hi,

Rain is in the forecast and {camperName} could use rain gear at camp (jacket and/or poncho). Please send labeled gear with your camper tomorrow if possible.

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
