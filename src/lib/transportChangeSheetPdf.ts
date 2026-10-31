import jsPDF from "jspdf";
import type { TransportChangeSheetRow } from "./transportChangeSheets";
import { PARENT_TRANSPORT_CHANGE_SHEET_BUS } from "./transportParentTransport";
import {
  addTransportPdfFooters,
  drawTransportPdfHeader,
  type TransportPdfLogo,
} from "@/lib/transportReportPdfLayout";

export type MasterChangeSheetPdfRow = {
  camper: string;
  transportation: string;
  division: string;
  group: string;
  change: string;
};

export type CamperSheetMeta = {
  division: string;
  group: string;
};

export function buildCamperSheetMetaLookup(
  children: {
    name: string;
    group_name?: string | null;
    grade?: string | null;
    division?: { name?: string | null } | null;
  }[],
): Map<string, CamperSheetMeta> {
  const map = new Map<string, CamperSheetMeta>();
  for (const child of children) {
    const key = child.name.trim().toLowerCase();
    if (!key) continue;
    map.set(key, {
      division: child.division?.name?.trim() || child.grade?.trim() || "",
      group: child.group_name?.trim() || "",
    });
  }
  return map;
}

export function formatChangeSheetTransportation(bus: string): string {
  const t = bus.trim();
  if (!t) return "";
  if (t === PARENT_TRANSPORT_CHANGE_SHEET_BUS || t.toUpperCase() === "PT") return "PT";
  const digits = t.match(/\d+/);
  if (digits) return digits[0].padStart(2, "0");
  return t;
}

export function formatChangeSheetChangeText(row: TransportChangeSheetRow): string {
  const desc = row.description.trim();
  if (desc) return desc;
  const source = row.source.trim();
  if (source) return source;
  return row.notes.trim() || "—";
}

export function mapRowsToMasterChangeSheetPdf(
  rows: TransportChangeSheetRow[],
  lookup: Map<string, CamperSheetMeta>,
): MasterChangeSheetPdfRow[] {
  return rows.map((row) => {
    const meta = lookup.get(row.camper.trim().toLowerCase());
    return {
      camper: row.camper,
      transportation: formatChangeSheetTransportation(row.bus),
      division: meta?.division ?? "",
      group: meta?.group ?? "",
      change: formatChangeSheetChangeText(row),
    };
  });
}

const COL_CAMER = 48;
const COL_TRANSPORT = 22;
const COL_DIVISION = 38;
const COL_GROUP = 32;
const ROW_HEIGHT = 6;
const HEADER_HEIGHT = 7;
const FOOTER = 12;

type ColumnDef = { label: string; width: number; key: keyof MasterChangeSheetPdfRow };

const COLUMNS: ColumnDef[] = [
  { label: "Camper", width: COL_CAMER, key: "camper" },
  { label: "Transportation", width: COL_TRANSPORT, key: "transportation" },
  { label: "Division", width: COL_DIVISION, key: "division" },
  { label: "Group", width: COL_GROUP, key: "group" },
  { label: "Change", width: 0, key: "change" },
];

function splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "—", maxWidth) as string[];
}

function drawTableHeader(doc: jsPDF, margin: number, y: number, tableRight: number): number {
  let x = margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  for (const col of COLUMNS) {
    const w = col.key === "change" ? tableRight - x : col.width;
    doc.text(col.label, x + 1, y + 5);
    x += w;
  }
  doc.setFont("helvetica", "normal");
  const bottom = y + HEADER_HEIGHT;
  doc.setLineWidth(0.35);
  doc.line(margin, y, tableRight, bottom);
  doc.line(margin, bottom, tableRight, bottom);
  return bottom;
}

function drawDataRow(
  doc: jsPDF,
  margin: number,
  tableRight: number,
  y: number,
  row: MasterChangeSheetPdfRow,
): number {
  const lineHeight = 3.8;
  let x = margin;
  const cellTexts: { width: number; lines: string[] }[] = [];

  for (const col of COLUMNS) {
    const w = col.key === "change" ? tableRight - x : col.width;
    const lines = splitText(doc, String(row[col.key]), w - 2);
    cellTexts.push({ width: w, lines });
    x += w;
  }

  const maxLines = Math.max(1, ...cellTexts.map((c) => c.lines.length));
  const rowH = Math.max(ROW_HEIGHT, maxLines * lineHeight + 2);

  x = margin;
  doc.setFontSize(8);
  for (let i = 0; i < COLUMNS.length; i++) {
    const col = COLUMNS[i];
    const w = col.key === "change" ? tableRight - x : col.width;
    const lines = cellTexts[i].lines;
    let textY = y + 4;
    for (const line of lines) {
      doc.text(line, x + 1, textY);
      textY += lineHeight;
    }
    x += w;
  }

  const bottom = y + rowH;
  doc.setLineWidth(0.15);
  doc.line(margin, bottom, tableRight, bottom);
  return bottom;
}

export function buildMasterChangeSheetPdf(options: {
  companyName: string;
  season: string;
  sheetDate: string;
  runPeriod: string;
  totalCampers?: number;
  rows: MasterChangeSheetPdfRow[];
  logo?: TransportPdfLogo | null;
  printedAt?: Date;
}): { blob: Blob; filename: string } | null {
  if (!options.rows.length) return null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const tableRight = pageWidth - margin;
  const printedAt = options.printedAt ?? new Date();

  const metaParts = [
    `Season ${options.season}`,
    `Date ${options.sheetDate}`,
    options.runPeriod.toUpperCase(),
  ];
  if (options.totalCampers != null) {
    metaParts.push(`Total Campers: ${options.totalCampers}`);
  }
  metaParts.push(`Changes: ${options.rows.length}`);

  let y = drawTransportPdfHeader(doc, margin, pageWidth, {
    companyName: options.companyName,
    reportTitle: "Consolidated Daily Passenger Update",
    metaLines: metaParts,
    logo: options.logo,
    printedAt,
  });

  y = drawTableHeader(doc, margin, y, tableRight);

  for (const row of options.rows) {
    if (y + ROW_HEIGHT > pageHeight - FOOTER) {
      doc.addPage();
      y = margin;
      y = drawTableHeader(doc, margin, y, tableRight);
    }
    y = drawDataRow(doc, margin, tableRight, y, row);
  }

  addTransportPdfFooters(doc, printedAt);

  const safeDate = options.sheetDate.replace(/[^0-9-]/g, "");
  const run = options.runPeriod.toLowerCase();
  return {
    blob: doc.output("blob"),
    filename: `master-change-sheet-${safeDate}-${run}.pdf`,
  };
}

export function downloadMasterChangeSheetPdf(
  options: Parameters<typeof buildMasterChangeSheetPdf>[0],
): boolean {
  const built = buildMasterChangeSheetPdf(options);
  if (!built) return false;
  const url = URL.createObjectURL(built.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = built.filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
