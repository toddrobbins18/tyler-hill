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

const FOOTER_BLOCK = 12;
const ROW_HEIGHT = 9;
const HEADER_HEIGHT = 8;
const SECTION_GAP = 6;

type SheetLayout = {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  tableLeft: number;
  tableRight: number;
  colNumRight: number;
  colNameRight: number;
  colStopRight: number;
  colPresentRight: number;
  colPresentCenter: number;
  colAbsentCenter: number;
  footerCol2Left: number;
  footerCol3Left: number;
  textNum: number;
  textName: number;
  textStop: number;
  usableBottom: number;
};

function createLayout(doc: jsPDF): SheetLayout {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const tableLeft = margin;
  const tableRight = pageWidth - margin;
  const presentWidth = 16;
  const absentWidth = 16;
  const numWidth = 8;
  const nameWidth = 52;

  const colPresentRight = tableRight;
  const colPresentLeft = colPresentRight - presentWidth;
  const colAbsentRight = colPresentLeft;
  const colAbsentLeft = colAbsentRight - absentWidth;
  const colStopRight = colAbsentLeft;
  const colNumRight = tableLeft + numWidth;
  const colNameRight = tableLeft + numWidth + nameWidth;

  const footerCol2Left = tableLeft + (tableRight - tableLeft) * 0.5;
  const footerCol3Left = tableLeft + (tableRight - tableLeft) * 0.72;

  return {
    pageWidth,
    pageHeight,
    margin,
    tableLeft,
    tableRight,
    colNumRight,
    colNameRight,
    colStopRight,
    colPresentRight,
    colPresentCenter: colPresentLeft + presentWidth / 2,
    colAbsentCenter: colAbsentLeft + absentWidth / 2,
    footerCol2Left,
    footerCol3Left,
    textNum: tableLeft + 2.5,
    textName: colNumRight + 2,
    textStop: colNameRight + 2,
    usableBottom: pageHeight - FOOTER_BLOCK,
  };
}

function columnBounds(layout: SheetLayout): number[] {
  return [
    layout.tableLeft,
    layout.colNumRight,
    layout.colNameRight,
    layout.colStopRight,
    layout.colPresentRight - 16,
    layout.tableRight,
  ];
}

function drawVerticalGrid(doc: jsPDF, layout: SheetLayout, top: number, bottom: number, lineWidth = 0.2) {
  doc.setDrawColor(0);
  doc.setLineWidth(lineWidth);
  for (const x of columnBounds(layout)) {
    doc.line(x, top, x, bottom);
  }
}

function addPageFooters(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const layout = createLayout(doc);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(
      `Page ${i} of ${totalPages}`,
      layout.pageWidth / 2,
      layout.pageHeight - 6,
      { align: "center" },
    );
    doc.setTextColor(0);
  }
}

function drawTitleBlock(
  doc: jsPDF,
  layout: SheetLayout,
  companyName: string,
  sheetTitle: string,
  metaLines: string[],
): number {
  let y = layout.margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName, layout.pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(11);
  doc.text(sheetTitle, layout.pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(metaLines.join("    "), layout.pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Mark one bubble per camper: Present (P) or Absent (A). Use when digital attendance is unavailable.",
    layout.pageWidth / 2,
    y,
    { align: "center", maxWidth: layout.tableRight - layout.tableLeft },
  );
  doc.setFont("helvetica", "normal");
  y += 4;

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(layout.tableLeft, y, layout.tableRight, y);
  doc.setLineWidth(0.15);
  doc.line(layout.tableLeft, y + 1.2, layout.tableRight, y + 1.2);

  return y + 6;
}

function drawTableHeader(doc: jsPDF, layout: SheetLayout, y: number): number {
  const rowTop = y;
  const rowBottom = y + HEADER_HEIGHT;

  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.line(layout.tableLeft, rowTop, layout.tableRight, rowTop);
  doc.line(layout.tableLeft, rowBottom, layout.tableRight, rowBottom);
  drawVerticalGrid(doc, layout, rowTop, rowBottom, 0.25);

  const textY = rowTop + 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("#", layout.textNum, textY);
  doc.text("Camper", layout.textName, textY);
  doc.text("Stop / Group", layout.textStop, textY);
  doc.text("Present", layout.colPresentCenter, textY, { align: "center" });
  doc.text("Absent", layout.colAbsentCenter, textY, { align: "center" });
  doc.setFont("helvetica", "normal");

  return rowBottom;
}

function drawSectionHeader(
  doc: jsPDF,
  layout: SheetLayout,
  title: string,
  subtitle: string | undefined,
  y: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(title.toUpperCase(), layout.tableLeft, y);

  let nextY = y + 4.5;
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(subtitle, layout.tableLeft, nextY);
    nextY += 4;
  }

  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.line(layout.tableLeft, nextY, layout.tableRight, nextY);

  return nextY + 3;
}

function drawBubble(doc: jsPDF, cx: number, cy: number, label: "P" | "A") {
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, 2.8, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(label, cx, cy + 0.7, { align: "center" });
  doc.setFont("helvetica", "normal");
}

function drawTableRow(
  doc: jsPDF,
  layout: SheetLayout,
  y: number,
  index: number,
  camper: BubbleSheetCamper,
) {
  const rowTop = y;
  const rowBottom = y + ROW_HEIGHT;

  doc.setDrawColor(0);
  doc.setLineWidth(0.15);
  doc.line(layout.tableLeft, rowBottom, layout.tableRight, rowBottom);
  drawVerticalGrid(doc, layout, rowTop, rowBottom, 0.15);

  const textY = rowTop + 5.8;
  doc.setFontSize(8);
  doc.text(String(index), layout.textNum, textY);
  doc.text(camper.name.slice(0, 32), layout.textName, textY);
  if (camper.detail) {
    doc.setFontSize(7.5);
    doc.text(camper.detail.slice(0, 38), layout.textStop, textY);
  }

  const bubbleCy = rowTop + ROW_HEIGHT / 2;
  drawBubble(doc, layout.colPresentCenter, bubbleCy, "P");
  drawBubble(doc, layout.colAbsentCenter, bubbleCy, "A");
}

function drawSignatureBlock(doc: jsPDF, layout: SheetLayout, y: number): number {
  const blockTop = y;
  const blockHeight = 15;
  const blockBottom = blockTop + blockHeight;
  const pad = 3;

  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.rect(layout.tableLeft, blockTop, layout.tableRight - layout.tableLeft, blockHeight, "S");
  doc.line(layout.footerCol2Left, blockTop, layout.footerCol2Left, blockBottom);
  doc.line(layout.footerCol3Left, blockTop, layout.footerCol3Left, blockBottom);

  const labelY = blockTop + 5;
  const lineY = blockTop + 11.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  doc.text("Supervisor signature", layout.tableLeft + pad, labelY);
  doc.line(layout.tableLeft + pad, lineY, layout.footerCol2Left - pad, lineY);

  doc.text("Bus arrived", layout.footerCol2Left + pad, labelY);
  doc.line(layout.footerCol2Left + pad, lineY, layout.footerCol3Left - pad, lineY);

  doc.text("Ready to depart", layout.footerCol3Left + pad, labelY);
  doc.line(layout.footerCol3Left + pad, lineY, layout.tableRight - pad, lineY);

  return blockBottom;
}

function renderBubbleSections(
  doc: jsPDF,
  companyName: string,
  sheetTitle: string,
  metaLines: string[],
  sections: BubbleSheetSection[],
) {
  const layout = createLayout(doc);
  let y = drawTitleBlock(doc, layout, companyName, sheetTitle, metaLines);

  const drawSectionTable = (section: BubbleSheetSection) => {
    y = drawSectionHeader(doc, layout, section.title, section.subtitle, y);
    y = drawTableHeader(doc, layout, y);

    for (let idx = 0; idx < section.campers.length; idx++) {
      if (y + ROW_HEIGHT > layout.usableBottom) {
        doc.addPage();
        y = layout.margin;
        y = drawSectionHeader(doc, layout, `${section.title} (continued)`, undefined, y);
        y = drawTableHeader(doc, layout, y);
      }
      drawTableRow(doc, layout, y, idx + 1, section.campers[idx]);
      y += ROW_HEIGHT;
    }
    y += SECTION_GAP;
  };

  const SIGNATURE_BLOCK_HEIGHT = 18;

  for (const section of sections) {
    if (!section.campers.length) continue;
    if (y + HEADER_HEIGHT + ROW_HEIGHT + 14 > layout.usableBottom) {
      doc.addPage();
      y = layout.margin;
    }
    drawSectionTable(section);
  }

  if (y + SIGNATURE_BLOCK_HEIGHT > layout.usableBottom) {
    doc.addPage();
    y = layout.margin;
  }
  drawSignatureBlock(doc, layout, y + 4);

  addPageFooters(doc);
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
      title: `${r.bus} · ${r.routeName}`,
      subtitle: `${r.campers.length} campers scheduled`,
      campers: r.campers,
    }));

  if (!sections.length) return false;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  renderBubbleSections(
    doc,
    options.companyName,
    "Bus Attendance Bubble Sheet",
    [`Date: ${options.date}`, `Run: ${options.runPeriod.toUpperCase()}`],
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

export function downloadCombinedAttendanceBubbleSheetPdf(options: {
  companyName: string;
  date: string;
  runPeriod: "am" | "pm";
  busRoutes: {
    bus: string;
    routeName: string;
    campers: BubbleSheetCamper[];
  }[];
  groups: {
    groupName: string;
    campers: BubbleSheetCamper[];
  }[];
}): boolean {
  const busSections: BubbleSheetSection[] = options.busRoutes
    .filter((r) => r.campers.length > 0)
    .map((r) => ({
      title: `${r.bus} · ${r.routeName}`,
      subtitle: `${r.campers.length} campers scheduled`,
      campers: r.campers,
    }));

  const groupSections: BubbleSheetSection[] = options.groups
    .filter((g) => g.campers.length > 0)
    .map((g) => ({
      title: `Group · ${g.groupName}`,
      subtitle: `${g.campers.length} campers`,
      campers: g.campers,
    }));

  const sections = [...busSections, ...groupSections];
  if (!sections.length) return false;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  renderBubbleSections(
    doc,
    options.companyName,
    "Day Camp Attendance Bubble Sheet",
    [`Date: ${options.date}`, `Run: ${options.runPeriod.toUpperCase()}`],
    sections,
  );

  const safeDate = options.date.replace(/[^0-9-]/g, "");
  doc.save(`daycamp-attendance-bubble-${safeDate}-${options.runPeriod}.pdf`);
  return true;
}
