import jsPDF from "jspdf";
import { format } from "date-fns";

export type TransportPdfLogo = {
  dataUrl: string;
  format: "PNG" | "JPEG" | "WEBP";
};

export type TransportPdfHeaderOptions = {
  companyName: string;
  reportTitle: string;
  metaLines: string[];
  subtitle?: string;
  logo?: TransportPdfLogo | null;
  printedAt?: Date;
};

/** Load remote camp logo for jsPDF (browser only). */
export async function loadTransportPdfLogo(
  logoUrl: string | null | undefined,
): Promise<TransportPdfLogo | null> {
  if (!logoUrl?.trim()) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const type = blob.type.toLowerCase();
    const format: TransportPdfLogo["format"] = type.includes("png")
      ? "PNG"
      : type.includes("webp")
        ? "WEBP"
        : "JPEG";
    return { dataUrl, format };
  } catch {
    return null;
  }
}

export function sanitizeBarcodePayload(raw: string): string {
  const cleaned = raw.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return cleaned.slice(0, 24);
}

/** CODE39 patterns (* = narrow/wide unit sequence). */
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  "*": "nwnnwnwnn",
};

export function drawCode39Barcode(
  doc: jsPDF,
  x: number,
  y: number,
  payload: string,
  options?: { heightMm?: number; narrowMm?: number; label?: boolean },
): number {
  const text = sanitizeBarcodePayload(payload);
  if (!text) return y;

  const encoded = `*${text}*`;
  const narrow = options?.narrowMm ?? 0.35;
  const wide = narrow * 3;
  const barH = options?.heightMm ?? 7;
  let cx = x;

  doc.setFillColor(0);
  doc.setDrawColor(0);

  for (const ch of encoded) {
    const pattern = CODE39[ch];
    if (!pattern) continue;
    let isBar = true;
    for (const unit of pattern) {
      const w = unit === "w" ? wide : narrow;
      if (isBar) {
        doc.rect(cx, y, w, barH, "F");
      }
      cx += w;
      isBar = !isBar;
    }
    cx += narrow;
  }

  if (options?.label !== false) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(text, x, y + barH + 2.5);
  }

  return y + barH + (options?.label !== false ? 4 : 0);
}

export function drawTransportPdfHeader(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  options: TransportPdfHeaderOptions,
): number {
  let y = margin;
  const logoH = 14;
  const logoW = 28;
  let textX = margin;

  if (options.logo) {
    try {
      doc.addImage(options.logo.dataUrl, options.logo.format, margin, y, logoW, logoH);
      textX = margin + logoW + 4;
    } catch {
      textX = margin;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(options.logo ? 11 : 12);
  doc.text(options.companyName, textX, y + 5);
  doc.setFontSize(10);
  doc.text(options.reportTitle, pageWidth - margin, y + 5, { align: "right" });

  y += options.logo ? logoH + 2 : 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const line of options.metaLines) {
    doc.text(line, pageWidth - margin, y, { align: "right" });
    y += 4;
  }
  const printed = options.printedAt ?? new Date();
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(`Printed ${format(printed, "MMM d, yyyy h:mm a")}`, pageWidth - margin, y, { align: "right" });
  doc.setTextColor(0);
  y += 4;

  if (options.subtitle) {
    y += 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(options.subtitle, margin, y);
    y += 6;
  }

  doc.setDrawColor(40);
  doc.setLineWidth(0.35);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.15);
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  return y + 3;
}

export function buildTransportTableReportPdf(options: {
  companyName: string;
  reportTitle: string;
  metaLines: string[];
  headers: string[];
  dataRows: string[][];
  logo?: TransportPdfLogo | null;
  printedAt?: Date;
  landscape?: boolean;
  filenameSlug: string;
}): { blob: Blob; filename: string } {
  const printedAt = options.printedAt ?? new Date();
  const doc = new jsPDF({
    orientation: options.landscape ? "landscape" : "portrait",
    unit: "mm",
    format: "letter",
  });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const footerMargin = 12;
  const colCount = Math.max(options.headers.length, 1);
  const colW = (pageWidth - margin * 2) / colCount;

  let y = drawTransportPdfHeader(doc, margin, pageWidth, {
    companyName: options.companyName,
    reportTitle: options.reportTitle,
    metaLines: options.metaLines,
    logo: options.logo,
    printedAt,
  });

  const drawHead = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    options.headers.forEach((header, i) => {
      doc.text(header, margin + i * colW + 1, y + 4);
    });
    y += 7;
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
  };

  drawHead();

  for (const row of options.dataRows) {
    const cellLines = row.map((cell, i) =>
      doc.splitTextToSize(String(cell ?? ""), colW - 2) as string[],
    );
    const rowH = Math.max(5, ...cellLines.map((lines) => lines.length * 3.2 + 1));

    if (y + rowH > pageHeight - footerMargin) {
      doc.addPage();
      y = margin;
      drawHead();
    }

    cellLines.forEach((lines, i) => {
      let cy = y + 3.5;
      for (const line of lines.slice(0, 4)) {
        doc.text(line, margin + i * colW + 1, cy);
        cy += 3.2;
      }
    });
    y += rowH;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setDrawColor(0);
  }

  addTransportPdfFooters(doc, printedAt);
  const slug = options.filenameSlug.replace(/[^\w-]+/g, "-");
  return {
    blob: doc.output("blob"),
    filename: `${slug}.pdf`,
  };
}

export function addTransportPdfFooters(doc: jsPDF, printedAt?: Date) {
  const total = doc.getNumberOfPages();
  const stamp = format(printedAt ?? new Date(), "yyyy-MM-dd HH:mm");
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.width;
    const h = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(`The Nest · ${stamp}`, 12, h - 5);
    doc.text(`Page ${i} of ${total}`, w / 2, h - 5, { align: "center" });
    doc.setTextColor(0);
  }
}
