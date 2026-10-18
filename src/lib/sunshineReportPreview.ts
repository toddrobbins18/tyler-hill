import { fitSheetLines, SUNSHINE_LAYOUT as L, SUNSHINE_TEMPLATE_HEIGHT, SUNSHINE_TEMPLATE_WIDTH } from "@/lib/sunshineLayout";

const TEMPLATE_URL = "/images/nsdc-sunshine-report-template.jpg?v=4";

let templateImage: HTMLImageElement | null = null;

function loadTemplate(): Promise<HTMLImageElement> {
  if (templateImage?.complete && templateImage.src.includes("v=4")) {
    return Promise.resolve(templateImage);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      templateImage = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error("Failed to load sunshine template"));
    img.src = TEMPLATE_URL;
  });
}

function drawOnBaselines(
  ctx: CanvasRenderingContext2D,
  items: string[],
  x: number,
  baselines: readonly number[],
  maxLines: number,
  fontSize: number,
) {
  ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#1f2937";
  const lines = fitSheetLines(items, maxLines);
  lines.forEach((line, i) => {
    const baseline = baselines[i];
    if (baseline == null) return;
    ctx.fillText(line, x, baseline);
  });
}

export async function renderSunshineReportPreviewDataUrl(input: {
  camperName: string;
  activities: string[];
  sports: string[];
  lunch: string[];
  bm: boolean;
  napped: boolean;
}): Promise<string> {
  const template = await loadTemplate();
  const canvas = document.createElement("canvas");
  canvas.width = SUNSHINE_TEMPLATE_WIDTH;
  canvas.height = SUNSHINE_TEMPLATE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(template, 0, 0, SUNSHINE_TEMPLATE_WIDTH, SUNSHINE_TEMPLATE_HEIGHT);

  const name = input.camperName.trim() || "Camper";
  ctx.font = `700 ${L.camper.fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#1d4ed8";
  ctx.fillText(name, L.camper.x, L.camper.baseline);

  drawOnBaselines(ctx, input.activities, L.activities.x, L.activities.baselines, L.activities.maxLines, L.activities.fontSize);
  drawOnBaselines(ctx, input.sports, L.sports.x, L.sports.baselines, L.sports.maxLines, L.sports.fontSize);
  drawOnBaselines(ctx, input.lunch, L.lunch.x, L.lunch.baselines, L.lunch.maxLines, L.lunch.fontSize);

  ctx.font = `800 ${L.bmCheck.fontSize}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#0f172a";
  if (input.bm) ctx.fillText("✓", L.bmCheck.x, L.bmCheck.baseline);
  if (input.napped) ctx.fillText("✓", L.napCheck.x, L.napCheck.baseline);

  return canvas.toDataURL("image/jpeg", 0.93);
}
