import type { PaperAttendanceListKind } from "@/lib/paperAttendance";
import { findPaperSheetLabelsInText } from "@/lib/paperAttendance";
import type { PaperScanPage } from "@/lib/paperAttendanceScan";
import type { PaperTextItem, RgbaImage } from "@/lib/paperAttendanceOmr";

function headerCanvas(image: RgbaImage): HTMLCanvasElement {
  const height = Math.max(80, Math.round(image.height * 0.24));
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const bytes = image.width * height * 4;
  const slice = new Uint8ClampedArray(image.data.subarray(0, bytes));
  ctx.putImageData(new ImageData(slice, image.width, height), 0, 0);
  return canvas;
}

export async function ocrPaperScanPages(
  pages: PaperScanPage[],
  expectedLabels: string[],
  kind: PaperAttendanceListKind,
): Promise<string> {
  const needOcr = pages.filter((page) => {
    if (!page.image) return false;
    return findPaperSheetLabelsInText(page.pageText ?? "", expectedLabels, kind).length === 0;
  });
  if (!needOcr.length) return "";

  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng");
  const texts: string[] = [];
  try {
    for (const page of needOcr) {
      if (!page.image) continue;
      const { data } = await worker.recognize(headerCanvas(page.image));
      const text = data.text?.trim() ?? "";
      if (!text) continue;
      page.pageText = `${page.pageText ?? ""} ${text}`.trim();
      texts.push(text);
    }
  } finally {
    await worker.terminate();
  }
  return texts.join("\n");
}

function nameColumnCanvas(image: RgbaImage): { canvas: HTMLCanvasElement; y0: number } {
  const y0 = Math.floor(image.height * 0.1);
  const width = Math.max(40, Math.floor(image.width * 0.5));
  const height = Math.max(40, Math.floor(image.height * 0.86));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, y0 };
  const copy = image.data instanceof Uint8ClampedArray
    ? image.data
    : new Uint8ClampedArray(image.data);
  const full = document.createElement("canvas");
  full.width = image.width;
  full.height = image.height;
  const fullCtx = full.getContext("2d");
  if (!fullCtx) return { canvas, y0 };
  fullCtx.putImageData(new ImageData(copy, image.width, image.height), 0, 0);
  ctx.drawImage(full, 0, y0, width, height, 0, 0, width, height);
  return { canvas, y0 };
}

/** Read the printed camper names so a mark stays with that row, not the Nest list order. */
export async function ocrPaperCamperNames(pages: PaperScanPage[]): Promise<void> {
  const targets = pages.filter((page) => page.image && (page.textItems?.length ?? 0) < 4);
  if (!targets.length) return;
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("eng");
  try {
    for (const page of targets) {
      if (!page.image) continue;
      const { canvas, y0 } = nameColumnCanvas(page.image);
      const { data } = await worker.recognize(canvas);
      const lines = (data as { lines?: Array<{ text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }> }).lines ?? [];
      const items: PaperTextItem[] = [];
      for (const line of lines) {
        const str = line.text?.replace(/\s+/g, " ").trim() ?? "";
        const box = line.bbox;
        if (!str || str.length < 4 || !box) continue;
        items.push({
          str,
          x: (box.x0 + box.x1) / 2,
          y: y0 + (box.y0 + box.y1) / 2,
        });
      }
      if (items.length) page.textItems = [...(page.textItems ?? []), ...items];
    }
  } finally {
    await worker.terminate();
  }
}
