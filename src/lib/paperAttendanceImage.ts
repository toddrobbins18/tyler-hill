import type { RgbaImage } from "@/lib/paperAttendanceOmr";
import { extractPdfLiteralStrings } from "@/lib/paperAttendancePdfText";
import type { PaperScanPage } from "@/lib/paperAttendanceScan";

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

function isPagePhoto(image: RgbaImage): boolean {
  return Math.min(image.width, image.height) >= 400 && Math.max(image.width, image.height) >= 600;
}

async function decodePdfJpegPages(
  jpegs: Uint8Array[],
  fileName: string,
): Promise<PaperScanPage[]> {
  const pages: PaperScanPage[] = [];
  let n = 0;
  for (const jpeg of jpegs) {
    n += 1;
    try {
      const image = await rgbaFromBlob(new Blob([jpeg], { type: "image/jpeg" }));
      if (!isPagePhoto(image)) continue;
      pages.push({ image, sourceName: `${fileName} page ${n}` });
    } catch {
      /* Nest PDFs often contain logo bytes that look like JPEGs but are not page photos. */
    }
  }
  return pages;
}

export async function loadRgbaFromBrowserFile(file: File): Promise<RgbaImage> {
  if (isPdfFile(file)) {
    throw new Error("Use Scan all sheets for a multi-page PDF.");
  }
  return rgbaFromBlob(file);
}

export type PaperScanFileInput = {
  pages: PaperScanPage[];
  documentText: string;
};

async function loadPdfJsDocument(buf: Uint8Array) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  return pdfjs.getDocument({ data: buf, disableWorker: true }).promise;
}

async function renderPdfPagesWithPdfJs(
  buf: Uint8Array,
  fileName: string,
): Promise<PaperScanPage[]> {
  const pdf = await loadPdfJsDocument(buf);
  const pages: PaperScanPage[] = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const textItems = await page.getTextContent();
    const pageText = textItems.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    const viewport = page.getViewport({ scale: 1.6 });
    const long = Math.max(viewport.width, viewport.height);
    const scale = long > MAX_SIDE ? MAX_SIDE / long : 1;
    const fit = page.getViewport({ scale: 1.6 * scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(fit.width));
    canvas.height = Math.max(1, Math.round(fit.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport: fit }).promise;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    pages.push({
      image: { width: image.width, height: image.height, data: image.data },
      pageText,
      sourceName: `${fileName} page ${n}`,
    });
  }
  return pages;
}

export async function loadPaperScanInputFromBrowserFiles(files: File[]): Promise<PaperScanFileInput> {
  const pages: PaperScanPage[] = [];
  const texts: string[] = [];
  for (const file of files) {
    if (isPdfFile(file)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      const documentText = extractPdfLiteralStrings(buf);
      if (documentText.trim()) texts.push(documentText);
      let rendered: PaperScanPage[] = [];
      try {
        rendered = await renderPdfPagesWithPdfJs(buf.slice(), file.name || "roster.pdf");
      } catch {
        rendered = [];
      }
      if (rendered.length) {
        pages.push(...rendered);
        for (const page of rendered) {
          if (page.pageText?.trim()) texts.push(page.pageText);
        }
        continue;
      }
      const jpegPages = await decodePdfJpegPages(extractJpegBuffersFromPdf(buf), file.name || "roster.pdf");
      pages.push(...jpegPages);
      continue;
    }
    try {
      pages.push({ image: await rgbaFromBlob(file), sourceName: file.name || "photo" });
    } catch {
      throw new Error("Could not read that file. Use one PDF for all buses, one PDF for all groups, or photos of the pages.");
    }
  }
  const documentText = texts.join("\n");
  if (!pages.length && !documentText.trim()) {
    throw new Error("Could not read that PDF. Use one PDF for all buses or one PDF for all groups.");
  }
  return { pages, documentText };
}

export async function loadRgbaPagesFromBrowserFiles(
  files: File[],
): Promise<Array<{ image: RgbaImage; sourceName: string }>> {
  const { pages } = await loadPaperScanInputFromBrowserFiles(files);
  return pages.filter((page): page is PaperScanPage & { image: RgbaImage } => !!page.image)
    .map((page) => ({ image: page.image, sourceName: page.sourceName }));
}
