import jsPDF from "jspdf";
import type { SwimFormationGroup } from "@/lib/swimGroupFormation";

export function buildSwimFormationReportPdf(options: {
  companyName: string;
  season: string;
  groups: SwimFormationGroup[];
  criteriaSummary?: string;
}): { blob: Blob; filename: string } | null {
  if (options.groups.length === 0) return null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(options.companyName, margin, y);
  y += 6;
  doc.setFontSize(11);
  doc.text("Swim group formation", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Season ${options.season}  ·  ${options.groups.length} groups`, margin, y);
  y += 4;
  if (options.criteriaSummary) {
    doc.setFontSize(8);
    doc.text(options.criteriaSummary, margin, y);
    y += 5;
  }
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  for (const group of options.groups) {
    const blockH = 8 + group.campers.length * 5 + 6;
    if (y + Math.min(blockH, 40) > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${group.label} (${group.campers.length})`, margin, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const cols = [
      { label: "Name", x: margin, w: 45 },
      { label: "Division", x: margin + 45, w: 35 },
      { label: "Group", x: margin + 80, w: 35 },
      { label: "Level", x: margin + 115, w: 35 },
      { label: "Div leader", x: margin + 150, w: 40 },
    ];
    cols.forEach((c) => doc.text(c.label, c.x, y));
    y += 4;
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    for (const c of group.campers) {
      if (y > pageHeight - margin - 6) {
        doc.addPage();
        y = margin;
      }
      doc.text(c.name, cols[0]!.x, y);
      doc.text(c.division, cols[1]!.x, y);
      doc.text(c.group, cols[2]!.x, y);
      doc.text(c.highestCompletedLevel, cols[3]!.x, y);
      doc.text(c.divisionLeader, cols[4]!.x, y);
      y += 4.5;
    }
    y += 6;
  }

  return {
    blob: doc.output("blob"),
    filename: `swim-formation-season-${options.season}.pdf`,
  };
}
