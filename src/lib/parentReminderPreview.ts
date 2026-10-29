import type { ParentEmailTemplateKey } from "@/lib/parentEmailTemplates";
import {
  PARENT_REMINDER_HEIGHT,
  PARENT_REMINDER_NAME as N,
  PARENT_REMINDER_WIDTH,
  parentReminderPublicUrl,
} from "@/lib/parentReminderLayout";

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load reminder template: ${url}`));
    img.src = url;
  });
}

export async function renderParentReminderPreviewDataUrl(
  templateKey: ParentEmailTemplateKey,
  camperName: string,
): Promise<string> {
  const template = await loadImage(parentReminderPublicUrl(templateKey));
  const canvas = document.createElement("canvas");
  canvas.width = PARENT_REMINDER_WIDTH;
  canvas.height = PARENT_REMINDER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(template, 0, 0, PARENT_REMINDER_WIDTH, PARENT_REMINDER_HEIGHT);

  const name = camperName.trim() || "Camper";
  ctx.fillStyle = N.color;
  ctx.font = `700 ${N.fontSize}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, N.x + N.width / 2, N.y + N.height / 2, N.width - 16);

  return canvas.toDataURL("image/jpeg", 0.92);
}
