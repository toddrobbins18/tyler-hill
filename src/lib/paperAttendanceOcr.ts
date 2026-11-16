import type { PaperAttendanceListKind } from "@/lib/paperAttendance";
import { findPaperSheetLabelsInText } from "@/lib/paperAttendance";
import type { PaperScanPage } from "@/lib/paperAttendanceScan";
import type { RgbaImage } from "@/lib/paperAttendanceOmr";

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
