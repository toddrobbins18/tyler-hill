import { renderParentEmailTemplate } from "./parentEmailTemplates.ts";
import {
  PARENT_REMINDER_ASSET,
  PARENT_REMINDER_HEIGHT,
  PARENT_REMINDER_NAME as N,
  PARENT_REMINDER_WIDTH,
  type ParentEmailTemplateKey,
} from "./parentReminderLayout.ts";
import { PARENT_REMINDER_JPEG_BASE64 } from "./parentReminderTemplatesEmbedded.ts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildParentReminderHtmlOverlay(
  templateKey: ParentEmailTemplateKey,
  camperName: string,
): { html: string; imageBase64: string } {
  const bg = PARENT_REMINDER_JPEG_BASE64[templateKey];
  const name = escapeHtml(camperName.trim() || "Camper");

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="position:relative;width:${PARENT_REMINDER_WIDTH}px;height:${PARENT_REMINDER_HEIGHT}px;margin:0 auto;">
    <img src="data:image/jpeg;base64,${bg}" alt="NSDC reminder" width="${PARENT_REMINDER_WIDTH}" height="${PARENT_REMINDER_HEIGHT}" style="position:absolute;left:0;top:0;width:${PARENT_REMINDER_WIDTH}px;height:${PARENT_REMINDER_HEIGHT}px;display:block;border:0;" />
    <div style="position:absolute;left:${N.x}px;top:${N.y}px;width:${N.width}px;height:${N.height}px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px;box-sizing:border-box;font-size:${N.fontSize}px;line-height:1.1;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:${N.color};overflow:hidden;">${name}</div>
  </div>
</body></html>`.trim();

  return { html, imageBase64: bg };
}

/** Full parent email: short text + inline graphic; attachment uses same JPEG bytes. */
export function buildParentReminderEmail(params: {
  templateKey: ParentEmailTemplateKey;
  camperName: string;
  campName: string;
}): {
  subject: string;
  html: string;
  attachmentName: string;
  attachmentBase64: string;
} {
  const rendered = renderParentEmailTemplate(params.templateKey, {
    camperName: params.camperName.trim() || "your camper",
    campName: params.campName,
  });
  if (!rendered) throw new Error("Template not found");

  const overlay = buildParentReminderHtmlOverlay(params.templateKey, params.camperName);
  const name = escapeHtml(params.camperName.trim() || "Camper");
  const textHtml = rendered.body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#334155;">${escapeHtml(line)}</p>`)
    .join("");

  const graphicBlock = `
  <div style="position:relative;width:${PARENT_REMINDER_WIDTH}px;height:${PARENT_REMINDER_HEIGHT}px;margin:16px auto 0;">
    <img src="data:image/jpeg;base64,${overlay.imageBase64}" alt="NSDC reminder" width="${PARENT_REMINDER_WIDTH}" height="${PARENT_REMINDER_HEIGHT}" style="position:absolute;left:0;top:0;width:${PARENT_REMINDER_WIDTH}px;height:${PARENT_REMINDER_HEIGHT}px;display:block;border:0;" />
    <div style="position:absolute;left:${N.x}px;top:${N.y}px;width:${N.width}px;height:${N.height}px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px;box-sizing:border-box;font-size:${N.fontSize}px;line-height:1.1;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:${N.color};overflow:hidden;">${name}</div>
  </div>`;

  const html = `<div style="max-width:720px;margin:0 auto;font-family:Arial,sans-serif;">${textHtml}${graphicBlock}</div>`;

  const attachmentName = PARENT_REMINDER_ASSET[params.templateKey].attachmentName;

  return {
    subject: rendered.subject,
    html,
    attachmentName,
    attachmentBase64: overlay.imageBase64,
  };
}
