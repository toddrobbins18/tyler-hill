import type { RgbaImage } from "@/lib/paperAttendanceOmr";

const MAX_SIDE = 1200;

export function extractJpegBuffersFromPdf(buf: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < buf.length - 1) {
    if (buf[i] === 0xff && buf[i + 1] === 0xd8) {
      let j = i + 2;
      while (j < buf.length - 1 && !(buf[j] === 0xff && buf[j + 1] === 0xd9)) j += 1;
      if (j < buf.length - 1) {
        const slice = buf.slice(i, j + 2);
        if (slice.length >= 8000) out.push(slice);
        i = j + 2;
        continue;
      }
    }
    i += 1;
  }
  return out;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function rgbaFromBlob(blob: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(blob);
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long > MAX_SIDE ? MAX_SIDE / long : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return { width: image.width, height: image.height, data: image.data };
}

export async function loadRgbaFromBrowserFile(file: File): Promise<RgbaImage> {
  if (isPdfFile(file)) {
    throw new Error("Use Scan all sheets for a multi-page PDF.");
  }
  return rgbaFromBlob(file);
}

export async function loadRgbaPagesFromBrowserFiles(
  files: File[],
): Promise<Array<{ image: RgbaImage; sourceName: string }>> {
  const pages: Array<{ image: RgbaImage; sourceName: string }> = [];
  for (const file of files) {
    if (isPdfFile(file)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const jpegs = extractJpegBuffersFromPdf(buf);
      if (!jpegs.length) {
        throw new Error(
          "That PDF has no page photos in it. Scan the printed sheets at the copier, or upload JPG/PNG photos of every page.",
        );
      }
      let n = 0;
      for (const jpeg of jpegs) {
        n += 1;
        const blob = new Blob([jpeg], { type: "image/jpeg" });
        pages.push({
          image: await rgbaFromBlob(blob),
          sourceName: `${file.name} page ${n}`,
        });
      }
      continue;
    }
    pages.push({ image: await rgbaFromBlob(file), sourceName: file.name || "photo" });
  }
  if (!pages.length) throw new Error("No pages in that file.");
  return pages;
}
