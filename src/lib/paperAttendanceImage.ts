import type { PaperTextItem, RgbaImage } from "@/lib/paperAttendanceOmr";
import { extractPdfLiteralStrings } from "@/lib/paperAttendancePdfText";
import type { PaperScanPage } from "@/lib/paperAttendanceScan";

const MAX_SIDE = 1600;

function findAscii(buf: Uint8Array, ascii: string, from = 0): number {
  const n = ascii.length;
  outer: for (let i = from; i <= buf.length - n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (buf[i + j] !== ascii.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

/** Real JPEGs start SOI + another marker. Copier Flate streams often contain stray FFD8 bytes. */
export function isStandaloneJpegPayload(buf: Uint8Array): boolean {
  return (
    buf.length >= 8000
    && buf[0] === 0xff
    && buf[1] === 0xd8
    && buf[2] === 0xff
    && buf[buf.length - 2] === 0xff
    && buf[buf.length - 1] === 0xd9
  );
}

export function extractJpegBuffersFromPdf(buf: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let i = 0;
  while (i < buf.length - 1) {
    if (buf[i] === 0xff && buf[i + 1] === 0xd8) {
      let j = i + 2;
      while (j < buf.length - 1 && !(buf[j] === 0xff && buf[j + 1] === 0xd9)) j += 1;
      if (j < buf.length - 1) {
        const slice = buf.slice(i, j + 2);
        if (isStandaloneJpegPayload(slice)) out.push(slice);
        i = j + 2;
        continue;
      }
    }
    i += 1;
  }
  return out;
}

/** Canon MRC pages: JPEG photo wrapped in Flate, plus a 1-bit text overlay. */
export function pdfUsesMixedRasterContent(buf: Uint8Array): boolean {
  return findAscii(buf, "/CCITTFaxDecode") >= 0 || findAscii(buf, "/FlateDecode /DCTDecode") >= 0;
}

export function extractFlateDctJpegBuffers(
  buf: Uint8Array,
  inflate: (data: Uint8Array) => Uint8Array,
): Uint8Array[] {
  const out: Uint8Array[] = [];
  let from = 0;
  while (from < buf.length) {
    const streamAt = findAscii(buf, "stream", from);
    if (streamAt < 0) break;
    if (
      streamAt >= 3
      && buf[streamAt - 3] === 101
      && buf[streamAt - 2] === 110
      && buf[streamAt - 1] === 100
    ) {
      from = streamAt + 6;
      continue;
    }
    const header = new TextDecoder("latin1").decode(buf.subarray(Math.max(0, streamAt - 480), streamAt));
    let dataStart = streamAt + 6;
    if (buf[dataStart] === 13 && buf[dataStart + 1] === 10) dataStart += 2;
    else if (buf[dataStart] === 10 || buf[dataStart] === 13) dataStart += 1;
    const end = findAscii(buf, "endstream", dataStart);
    if (end < 0) break;
    from = end + 9;
    if (!header.includes("DCTDecode") || !header.includes("FlateDecode")) continue;
    let data = buf.subarray(dataStart, end);
    if (data.length >= 2 && data[data.length - 2] === 13 && data[data.length - 1] === 10) {
      data = data.subarray(0, data.length - 2);
    } else if (data.length >= 1 && (data[data.length - 1] === 10 || data[data.length - 1] === 13)) {
      data = data.subarray(0, data.length - 1);
    }
    try {
      const raw = inflate(data);
      if (raw.length >= 8000 && raw[0] === 0xff && raw[1] === 0xd8) out.push(raw);
    } catch {
      /* skip a bad stream */
    }
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
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    const viewport = page.getViewport({ scale: 1.6 });
    const long = Math.max(viewport.width, viewport.height);
    const scale = long > MAX_SIDE ? MAX_SIDE / long : 1;
    const fit = page.getViewport({ scale: 1.6 * scale });
    const positioned: PaperTextItem[] = [];
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim() || !("transform" in item)) continue;
      const transform = item.transform as number[];
      const [x, y] = fit.convertToViewportPoint(transform[4], transform[5]);
      positioned.push({ str: item.str, x, y });
    }
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
      textItems: positioned,
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
      // Canon copier PDFs store printed titles in a 1-bit overlay. Raw JPEG
      // bytes in the file are either Flate-wrapped or incomplete, so pdf.js
      // must paint the page before we fall back to JPEG extraction.
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
      let jpegBufs = extractJpegBuffersFromPdf(buf);
      try {
        const { unzlibSync } = await import("fflate");
        const inflated = extractFlateDctJpegBuffers(buf, (data) => unzlibSync(data));
        if (inflated.length) jpegBufs = inflated;
      } catch {
        /* pdf.js already tried; plain DCT JPEGs still work below */
      }
      const jpegPages = await decodePdfJpegPages(jpegBufs, file.name || "roster.pdf");
      if (jpegPages.length) {
        pages.push(...jpegPages);
      }
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
