import { NSDC_SUNSHINE_TEMPLATE_JPEG_BASE64 } from "./sunshineTemplateEmbedded.ts";
import {
  fitSheetLines,
  SUNSHINE_LAYOUT as L,
  SUNSHINE_TEMPLATE_HEIGHT,
  SUNSHINE_TEMPLATE_WIDTH,
} from "./sunshineLayout.ts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TEXT =
  "font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-weight:600;color:#1f2937;";

function baselineToTop(baseline: number, fontSize: number): number {
  return baseline - fontSize + 2;
}

function linesHtml(
  items: string[],
  x: number,
  baselines: readonly number[],
  maxLines: number,
  fontSize: number,
  width: number,
): string {
  return fitSheetLines(items, maxLines)
    .map((line, i) => {
      const baseline = baselines[i];
      if (baseline == null) return "";
      const top = baselineToTop(baseline, fontSize);
      return `<div style="position:absolute;left:${x}px;top:${top}px;width:${width}px;font-size:${fontSize}px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${TEXT}">${escapeHtml(line)}</div>`;
    })
    .join("");
}

export function buildSunshineReportHtmlOverlay(params: {
  camperName: string;
  activities: string[];
  sports: string[];
  lunch: string[];
  bm: boolean;
  napped: boolean;
}): { html: string; imageBase64: string } {
  const bg = NSDC_SUNSHINE_TEMPLATE_JPEG_BASE64;
  const name = escapeHtml(params.camperName.trim() || "Camper");
  const camperTop = baselineToTop(L.camper.baseline, L.camper.fontSize);

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#fff;">
  <div style="position:relative;width:${SUNSHINE_TEMPLATE_WIDTH}px;height:${SUNSHINE_TEMPLATE_HEIGHT}px;margin:0 auto;">
    <img src="data:image/jpeg;base64,${bg}" alt="NSDC Sunshine Report" width="${SUNSHINE_TEMPLATE_WIDTH}" height="${SUNSHINE_TEMPLATE_HEIGHT}" style="position:absolute;left:0;top:0;width:${SUNSHINE_TEMPLATE_WIDTH}px;height:${SUNSHINE_TEMPLATE_HEIGHT}px;display:block;" />
    <div style="position:absolute;left:0;top:0;width:${SUNSHINE_TEMPLATE_WIDTH}px;height:${SUNSHINE_TEMPLATE_HEIGHT}px;">
      <div style="position:absolute;left:${L.camper.x}px;top:${camperTop}px;max-width:420px;font-size:${L.camper.fontSize}px;line-height:1;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:#1d4ed8;">${name}</div>
      ${linesHtml(params.activities, L.activities.x, L.activities.baselines, L.activities.maxLines, L.activities.fontSize, 268)}
      ${linesHtml(params.sports, L.sports.x, L.sports.baselines, L.sports.maxLines, L.sports.fontSize, 268)}
      ${linesHtml(params.lunch, L.lunch.x, L.lunch.baselines, L.lunch.maxLines, L.lunch.fontSize, 558)}
      ${params.bm ? `<div style="position:absolute;left:${L.bmCheck.x}px;top:${baselineToTop(L.bmCheck.baseline, L.bmCheck.fontSize)}px;font-size:${L.bmCheck.fontSize}px;font-weight:800;${TEXT}">✓</div>` : ""}
      ${params.napped ? `<div style="position:absolute;left:${L.napCheck.x}px;top:${baselineToTop(L.napCheck.baseline, L.napCheck.fontSize)}px;font-size:${L.napCheck.fontSize}px;font-weight:800;${TEXT}">✓</div>` : ""}
    </div>
  </div>
</body></html>`.trim();

  return { html, imageBase64: bg };
}
