import jsPDF from "jspdf";
import type { BraceletColor, BraceletRecord } from "@/lib/swimProgram";

export type SwimBraceletPrintPreset = {
  id: string;
  label: string;
  colors: BraceletColor[];
};

/** Todd proctor sheets — Nest uses Airtable bracelet colors (no Purple in catalog). */
export const SWIM_BRACELET_PRINT_PRESETS: SwimBraceletPrintPreset[] = [
  { id: "orange", label: "Orange only", colors: ["Orange"] },
  { id: "orange-yellow", label: "Orange + Yellow", colors: ["Orange", "Yellow"] },
  { id: "red-orange", label: "Red + Orange", colors: ["Red", "Orange"] },
];

export function filterBraceletRecordsByColors(
  records: BraceletRecord[],
  colors: BraceletColor[],
): BraceletRecord[] {
  if (colors.length === 0) return records;
  const set = new Set(colors);
  return records.filter((r) => r.currentBracelet && set.has(r.currentBracelet));
}

const COLS = [
  { key: "name", label: "Name", w: 36 },
  { key: "group", label: "Group", w: 22 },
  { key: "leader", label: "Div leader", w: 22 },
  { key: "bracelet", label: "Bracelet", w: 28 },
  { key: "note", label: "Note", w: 30 },
  { key: "tests", label: "Tests (proctor / date)", w: 42 },
] as const;

function formatTests(r: BraceletRecord): string {
  const parts: string[] = [];
  const slots = [
    [r.proctor1, r.date1],
    [r.proctor2, r.date2],
    [r.proctor3, r.date3],
    [r.proctor4, r.date4],
    [r.proctor5, r.date5],
  ] as const;
  slots.forEach(([p, d], i) => {
    if (!p?.trim() && !d?.trim()) return;
    parts.push(`${i + 1}: ${p || "—"} ${d || ""}`.trim());
  });
  return parts.join("; ") || "—";
}

export function buildSwimBraceletReportPdf(options: {
  companyName: string;
  season: string;
  reportTitle: string;
  records: BraceletRecord[];
}): { blob: Blob; filename: string } | null {
  if (options.records.length === 0) return null;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(options.companyName, margin, y);
  doc.setFontSize(10);
  doc.text(options.reportTitle, pageWidth - margin, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Season ${options.season}  ·  ${options.records.length} camper${options.records.length === 1 ? "" : "s"}`,
    margin,
    y,
  );
  y += 6;
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    let x = margin;
    for (const col of COLS) {
      doc.text(col.label, x + 1, y + 4);
      x += col.w;
    }
    y += 7;
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
    doc.setFont("helvetica", "normal");
  };

  drawHeader();

  for (const r of options.records) {
    const rowCells = {
      name: r.name,
      group: r.group || "—",
      leader: r.divisionLeader || "—",
      bracelet: r.currentBracelet || "—",
      note: r.generalNote?.trim() || "—",
      tests: formatTests(r),
    };

    const lineSets = COLS.map((col) =>
      doc.splitTextToSize(String(rowCells[col.key]), col.w - 2) as string[],
    );
    const rowH = Math.max(7, ...lineSets.map((lines) => lines.length * 3.2 + 2));

    if (y + rowH > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }

    let x = margin;
    COLS.forEach((col, i) => {
      let cy = y + 3.5;
      for (const line of lineSets[i]!.slice(0, 6)) {
        doc.text(line, x + 1, cy);
        cy += 3.2;
      }
      x += col.w;
    });
    y += rowH;
    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setDrawColor(0);
  }

  const safeTitle = options.reportTitle.replace(/[^\w-]+/g, "-").slice(0, 40);
  return {
    blob: doc.output("blob"),
    filename: `swim-bracelets-${safeTitle}-season-${options.season}.pdf`,
  };
}
