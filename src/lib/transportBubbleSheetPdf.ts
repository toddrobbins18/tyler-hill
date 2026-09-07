import jsPDF from "jspdf";

export type BubbleSheetCamper = {
  name: string;
  detail?: string;
};

export type BubbleSheetSection = {
  title: string;
  subtitle?: string;
  campers: BubbleSheetCamper[];
};

const PAGE_MARGIN = 14;
const ROW_HEIGHT = 7;
const HEADER_BLOCK = 38;
const FOOTER_BLOCK = 12;

function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    `Page ${pageNum} of ${totalPages} · Backup bubble sheet · Generated ${new Date().toLocaleString()}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: "center" },
  );
  doc.setTextColor(0);
}

function drawBubbleRow(
  doc: jsPDF,
  y: number,
  index: number,
  camper: BubbleSheetCamper,
  columns: { nameX: number; detailX: number; pX: number; aX: number },
) {
  doc.setFontSize(9);
  doc.text(String(index), PAGE_MARGIN, y);
  doc.text(camper.name.slice(0, 32), columns.nameX, y);
  if (camper.detail) {
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(camper.detail.slice(0, 28), columns.detailX, y);
    doc.setTextColor(0);
    doc.setFontSize(9);
  }
  doc.setDrawColor(40);
  doc.setLineWidth(0.4);
  doc.circle(columns.pX, y - 2.5, 2.2, "S");
  doc.circle(columns.aX, y - 2.5, 2.2, "S");
  doc.setFontSize(6);
  doc.text("P", columns.pX - 1, y + 0.5);
  doc.text("A", columns.aX - 1, y + 0.5);
}

function renderBubbleSections(
  doc: jsPDF,
  companyName: string,
  sheetTitle: string,
  metaLines: string[],
  sections: BubbleSheetSection[],
) {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const usableHeight = pageHeight - FOOTER_BLOCK;
  const nameX = PAGE_MARGIN + 8;
  const detailX = PAGE_MARGIN + 62;
  const pX = pageWidth - PAGE_MARGIN - 18;
  const aX = pageWidth - PAGE_MARGIN - 8;

  let y = PAGE_MARGIN;
  let pageCount = 1;

  const startNewPage = (sectionTitle?: string) => {
    doc.addPage();
    pageCount += 1;
    y = PAGE_MARGIN + 8;
    if (sectionTitle) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(sectionTitle, PAGE_MARGIN, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("#", PAGE_MARGIN, y);
      doc.text("Camper", nameX, y);
      doc.text("Stop / Group", detailX, y);
      doc.text("Present", pX - 4, y);
      doc.text("Absent", aX - 4, y);
      doc.setLineWidth(0.2);
      doc.line(PAGE_MARGIN, y + 1.5, pageWidth - PAGE_MARGIN, y + 1.5);
      y += ROW_HEIGHT;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(12);
  doc.text(sheetTitle, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const line of metaLines) {
    doc.text(line, pageWidth / 2, y, { align: "center" });
    y += 4.5;
  }
  y += 2;
  doc.setFontSize(8);
  doc.text(
    "Fill in the circle for Present (P) or Absent (A). Use when the digital attendance screen is unavailable.",
    pageWidth / 2,
    y,
    { align: "center", maxWidth: pageWidth - PAGE_MARGIN * 2 },
  );
  y += 8;

  for (const section of sections) {
    if (section.campers.length === 0) continue;

    if (y > PAGE_MARGIN + 10) y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.title, PAGE_MARGIN, y);
    y += 4;
    if (section.subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(section.subtitle, PAGE_MARGIN, y);
      doc.setTextColor(0);
      y += 5;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("#", PAGE_MARGIN, y);
    doc.text("Camper", nameX, y);
    doc.text("Stop / Group", detailX, y);
    doc.text("Present", pX - 4, y);
    doc.text("Absent", aX - 4, y);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN, y + 1.5, pageWidth - PAGE_MARGIN, y + 1.5);
    y += ROW_HEIGHT;

    section.campers.forEach((camper, idx) => {
      if (y + ROW_HEIGHT > usableHeight) {
        startNewPage(section.title);
      }
      drawBubbleRow(doc, y, idx + 1, camper, { nameX, detailX, pX, aX });
      y += ROW_HEIGHT;
    });
  }

  if (y + 16 < usableHeight) {
    y += 6;
    doc.setFontSize(8);
    doc.text("Supervisor signature: _________________________", PAGE_MARGIN, y);
    y += 6;
    doc.text("Bus arrived: __________   Ready to depart: __________", PAGE_MARGIN, y);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }
}

export function downloadBusBubbleSheetsPdf(options: {
  companyName: string;
  date: string;
  runPeriod: "am" | "pm";
  routes: {
    bus: string;
    routeName: string;
    campers: BubbleSheetCamper[];
  }[];
}): boolean {
  const sections = options.routes
    .filter((r) => r.campers.length > 0)
    .map((r) => ({
      title: `${r.bus} — ${r.routeName}`,
      subtitle: `${r.campers.length} campers scheduled`,
      campers: r.campers,
    }));

  if (!sections.length) return false;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  renderBubbleSections(
    doc,
    options.companyName,
    "Bus Attendance Bubble Sheet",
    [
      `Date: ${options.date}`,
      `Run: ${options.runPeriod.toUpperCase()}`,
    ],
    sections,
  );

  const safeDate = options.date.replace(/[^0-9-]/g, "");
  doc.save(`bus-bubble-sheets-${safeDate}-${options.runPeriod}.pdf`);
  return true;
}

export function downloadGroupBubbleSheetPdf(options: {
  companyName: string;
  date: string;
  groups: {
    groupName: string;
    campers: BubbleSheetCamper[];
  }[];
}): boolean {
  const sections = options.groups
    .filter((g) => g.campers.length > 0)
    .map((g) => ({
      title: g.groupName,
      subtitle: `${g.campers.length} campers`,
      campers: g.campers,
    }));

  if (!sections.length) return false;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  renderBubbleSections(
    doc,
    options.companyName,
    "Group Attendance Bubble Sheet",
    [`Date: ${options.date}`],
    sections,
  );

  const safeDate = options.date.replace(/[^0-9-]/g, "");
  doc.save(`group-bubble-sheet-${safeDate}.pdf`);
  return true;
}
