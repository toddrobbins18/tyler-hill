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

export type WeekDayColumn = {
  label: string;
  sublabel?: string;
};

const DAILY_SHEET_INSTRUCTION =
  "Mark one bubble per camper: Present (P) or Absent (A). Use when digital attendance is unavailable.";

const DAY_BUS_INSTRUCTION =
  "AM lists who rides the bus this morning. PM lists who rides this afternoon. A same-day pickup or other exception is left off that run only.";

const WEEKLY_BUS_INSTRUCTION =
  "Mark Present (P) for each AM and PM run this week. One row per camper — siblings each get their own row.";

const WEEKLY_GROUP_INSTRUCTION =
  "Mark Present (P) in the bubble for each weekday the camper attends. Five bubbles per row — one per day.";

const COMBINED_SHEET_INSTRUCTION =
  "Bus sections: mark Present (P) or Absent (A) for today. Group sections: mark Present (P) for each weekday.";

const FOOTER_BLOCK = 12;
const WEEKLY_HEADER_HEIGHT = 10;
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

type WeeklySheetLayout = {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  tableLeft: number;
  tableRight: number;
  colNumRight: number;
  colNameRight: number;
  dayColumnCenters: number[];
  dayColumnBounds: number[];
  footerCol2Left: number;
  footerCol3Left: number;
  textNum: number;
  textName: number;
  usableBottom: number;
};

function createWeeklyLayout(doc: jsPDF, dayCount = 5): WeeklySheetLayout {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const tableLeft = margin;
  const tableRight = pageWidth - margin;
  const numWidth = 8;
  const nameWidth = 50;
  const colNumRight = tableLeft + numWidth;
  const colNameRight = colNumRight + nameWidth;
  const dayWidth = (tableRight - colNameRight) / dayCount;
  const dayColumnCenters: number[] = [];
  const dayColumnBounds: number[] = [tableLeft, colNumRight, colNameRight];

  for (let i = 0; i < dayCount; i++) {
    const left = colNameRight + i * dayWidth;
    dayColumnBounds.push(left + dayWidth);
    dayColumnCenters.push(left + dayWidth / 2);
  }

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
    dayColumnCenters,
    dayColumnBounds,
    footerCol2Left,
    footerCol3Left,
    textNum: tableLeft + 2.5,
    textName: colNumRight + 2,
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
  tableLeft: number,
  tableRight: number,
  pageWidth: number,
  margin: number,
  companyName: string,
  sheetTitle: string,
  metaLines: string[],
  instruction: string,
): number {
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(11);
  doc.text(sheetTitle, pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(metaLines.join("    "), pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.text(instruction, pageWidth / 2, y, {
    align: "center",
    maxWidth: tableRight - tableLeft,
  });
  doc.setFont("helvetica", "normal");
  y += 4;

  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(tableLeft, y, tableRight, y);
  doc.setLineWidth(0.15);
  doc.line(tableLeft, y + 1.2, tableRight, y + 1.2);

  return y + 6;
}

function drawTableHeader(
  doc: jsPDF,
  layout: SheetLayout,
  y: number,
  detailColumnLabel = "Stop / Group",
): number {
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
  doc.text(detailColumnLabel, layout.textStop, textY);
  doc.text("Present", layout.colPresentCenter, textY, { align: "center" });
  doc.text("Absent", layout.colAbsentCenter, textY, { align: "center" });
  doc.setFont("helvetica", "normal");

  return rowBottom;
}

function drawSectionHeader(
  doc: jsPDF,
  layout: { tableLeft: number; tableRight: number },
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

function drawWeeklyVerticalGrid(
  doc: jsPDF,
  layout: WeeklySheetLayout,
  top: number,
  bottom: number,
  lineWidth = 0.2,
) {
  doc.setDrawColor(0);
  doc.setLineWidth(lineWidth);
  for (const x of layout.dayColumnBounds) {
    doc.line(x, top, x, bottom);
  }
}

function drawWeeklyTableHeader(
  doc: jsPDF,
  layout: WeeklySheetLayout,
  y: number,
  weekDays: WeekDayColumn[],
): number {
  const rowTop = y;
  const rowBottom = y + WEEKLY_HEADER_HEIGHT;

  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.line(layout.tableLeft, rowTop, layout.tableRight, rowTop);
  doc.line(layout.tableLeft, rowBottom, layout.tableRight, rowBottom);
  drawWeeklyVerticalGrid(doc, layout, rowTop, rowBottom, 0.25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("#", layout.textNum, rowTop + 5.5);
  doc.text("Camper", layout.textName, rowTop + 5.5);

  weekDays.forEach((day, index) => {
    const cx = layout.dayColumnCenters[index];
    if (!cx) return;
    doc.text(day.label, cx, rowTop + 4.5, { align: "center" });
    if (day.sublabel) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text(day.sublabel, cx, rowTop + 8, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
    }
  });
  doc.setFont("helvetica", "normal");

  return rowBottom;
}

function drawWeeklyTableRow(
  doc: jsPDF,
  layout: WeeklySheetLayout,
  y: number,
  index: number,
  camper: BubbleSheetCamper,
  weekDays: WeekDayColumn[],
) {
  const rowTop = y;
  const rowBottom = y + ROW_HEIGHT;

  doc.setDrawColor(0);
  doc.setLineWidth(0.15);
  doc.line(layout.tableLeft, rowBottom, layout.tableRight, rowBottom);
  drawWeeklyVerticalGrid(doc, layout, rowTop, rowBottom, 0.15);

  const textY = rowTop + 5.8;
  doc.setFontSize(8);
  doc.text(String(index), layout.textNum, textY);
  doc.text(camper.name.slice(0, 36), layout.textName, textY);

  const bubbleCy = rowTop + ROW_HEIGHT / 2;
  weekDays.forEach((_, dayIndex) => {
    const cx = layout.dayColumnCenters[dayIndex];
    if (cx) drawBubble(doc, cx, bubbleCy, "P");
  });
}

function drawSignatureBlock(
  doc: jsPDF,
  tableLeft: number,
  tableRight: number,
  footerCol2Left: number,
  footerCol3Left: number,
  y: number,
): number {
  const blockTop = y;
  const blockHeight = 15;
  const blockBottom = blockTop + blockHeight;
  const pad = 3;

  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.rect(tableLeft, blockTop, tableRight - tableLeft, blockHeight, "S");
  doc.line(footerCol2Left, blockTop, footerCol2Left, blockBottom);
  doc.line(footerCol3Left, blockTop, footerCol3Left, blockBottom);

  const labelY = blockTop + 5;
  const lineY = blockTop + 11.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  doc.text("Supervisor signature", tableLeft + pad, labelY);
  doc.line(tableLeft + pad, lineY, footerCol2Left - pad, lineY);

  doc.text("Bus arrived", footerCol2Left + pad, labelY);
  doc.line(footerCol2Left + pad, lineY, footerCol3Left - pad, lineY);

  doc.text("Ready to depart", footerCol3Left + pad, labelY);
  doc.line(footerCol3Left + pad, lineY, tableRight - pad, lineY);

  return blockBottom;
}

type BubbleSheetPart =
  | { layout: "daily"; sections: BubbleSheetSection[]; detailColumnLabel?: string }
  | { layout: "weekly"; sections: BubbleSheetSection[]; weekDays: WeekDayColumn[] };

function renderBubbleDocument(
  doc: jsPDF,
  companyName: string,
  sheetTitle: string,
  metaLines: string[],
  parts: BubbleSheetPart[],
  instruction?: string,
) {
  const dailyLayout = createLayout(doc);
  const maxWeeklyDays = Math.max(
    5,
    ...parts.filter((p) => p.layout === "weekly").map((p) => p.weekDays.length),
  );
  const weeklyLayout = createWeeklyLayout(doc, maxWeeklyDays);
  const activeParts = parts.filter((part) => part.sections.some((s) => s.campers.length));
  if (!activeParts.length) return;

  const resolvedInstruction =
    instruction ??
    (activeParts.every((part) => part.layout === "weekly")
      ? WEEKLY_GROUP_INSTRUCTION
      : activeParts.every((part) => part.layout === "daily")
        ? DAILY_SHEET_INSTRUCTION
        : COMBINED_SHEET_INSTRUCTION);

  let y = drawTitleBlock(
    doc,
    dailyLayout.tableLeft,
    dailyLayout.tableRight,
    dailyLayout.pageWidth,
    dailyLayout.margin,
    companyName,
    sheetTitle,
    metaLines,
    resolvedInstruction,
  );

  const SIGNATURE_BLOCK_HEIGHT = 18;

  for (const part of activeParts) {
    if (part.layout === "daily") {
      const detailColumnLabel = part.detailColumnLabel ?? "Stop / Group";
      for (const section of part.sections) {
        if (!section.campers.length) continue;
        if (y + HEADER_HEIGHT + ROW_HEIGHT + 14 > dailyLayout.usableBottom) {
          doc.addPage();
          y = dailyLayout.margin;
        }

        y = drawSectionHeader(doc, dailyLayout, section.title, section.subtitle, y);
        y = drawTableHeader(doc, dailyLayout, y, detailColumnLabel);

        for (let idx = 0; idx < section.campers.length; idx++) {
          if (y + ROW_HEIGHT > dailyLayout.usableBottom) {
            doc.addPage();
            y = dailyLayout.margin;
            y = drawSectionHeader(doc, dailyLayout, `${section.title} (continued)`, undefined, y);
            y = drawTableHeader(doc, dailyLayout, y, detailColumnLabel);
          }
          drawTableRow(doc, dailyLayout, y, idx + 1, section.campers[idx]);
          y += ROW_HEIGHT;
        }
        y += SECTION_GAP;
      }
    } else {
      const weekDays = part.weekDays.slice(0, maxWeeklyDays);
      for (const section of part.sections) {
        if (!section.campers.length) continue;
        if (y + WEEKLY_HEADER_HEIGHT + ROW_HEIGHT + 14 > weeklyLayout.usableBottom) {
          doc.addPage();
          y = weeklyLayout.margin;
        }

        y = drawSectionHeader(doc, weeklyLayout, section.title, section.subtitle, y);
        y = drawWeeklyTableHeader(doc, weeklyLayout, y, weekDays);

        for (let idx = 0; idx < section.campers.length; idx++) {
          if (y + ROW_HEIGHT > weeklyLayout.usableBottom) {
            doc.addPage();
            y = weeklyLayout.margin;
            y = drawSectionHeader(doc, weeklyLayout, `${section.title} (continued)`, undefined, y);
            y = drawWeeklyTableHeader(doc, weeklyLayout, y, weekDays);
          }
          drawWeeklyTableRow(doc, weeklyLayout, y, idx + 1, section.campers[idx], weekDays);
          y += ROW_HEIGHT;
        }
        y += SECTION_GAP;
      }
    }
  }

  if (y + SIGNATURE_BLOCK_HEIGHT > dailyLayout.usableBottom) {
    doc.addPage();
    y = dailyLayout.margin;
  }
  drawSignatureBlock(
    doc,
    dailyLayout.tableLeft,
    dailyLayout.tableRight,
    dailyLayout.footerCol2Left,
    dailyLayout.footerCol3Left,
    y + 4,
  );

  addPageFooters(doc);
}

function renderBubbleSections(
  doc: jsPDF,
  companyName: string,
  sheetTitle: string,
  metaLines: string[],
  sections: BubbleSheetSection[],
  options?: { detailColumnLabel?: string },
) {
  renderBubbleDocument(doc, companyName, sheetTitle, metaLines, [
    {
      layout: "daily",
      sections,
      detailColumnLabel: options?.detailColumnLabel,
    },
  ]);
}

export type TransportReportPdf = {
  blob: Blob;
  filename: string;
};

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildBusBubbleSheetsPdf(options: {
  companyName: string;
  enrollmentWeek: number;
  weekDateRange?: string;
  weekDays: WeekDayColumn[];
  routes: {
    bus: string;
    routeName: string;
    campers: BubbleSheetCamper[];
  }[];
}): TransportReportPdf | null {
  const sections = options.routes
    .filter((r) => r.campers.length > 0)
    .map((r) => ({
      title: `${r.bus} · ${r.routeName}`,
      subtitle: `${r.campers.length} campers enrolled this week`,
      campers: r.campers,
    }));

  if (!sections.length) return null;

  const amPmDays: WeekDayColumn[] = [];
  for (const day of options.weekDays.slice(0, 5)) {
    amPmDays.push({ label: day.label, sublabel: day.sublabel ? `${day.sublabel} AM` : "AM" });
    amPmDays.push({ label: day.label, sublabel: day.sublabel ? `${day.sublabel} PM` : "PM" });
  }

  const metaLines = [`Enrollment Week: ${options.enrollmentWeek}`];
  if (options.weekDateRange) metaLines.push(`Dates: ${options.weekDateRange}`);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  renderBubbleDocument(
    doc,
    options.companyName,
    "Bus Attendance Bubble Sheet (Weekly AM & PM)",
    metaLines,
    [{ layout: "weekly", sections, weekDays: amPmDays }],
    WEEKLY_BUS_INSTRUCTION,
  );

  return {
    blob: doc.output("blob"),
    filename: `bus-bubble-sheets-week-${options.enrollmentWeek}.pdf`,
  };
}

export function downloadBusBubbleSheetsPdf(options: {
  companyName: string;
  enrollmentWeek: number;
  weekDateRange?: string;
  weekDays: WeekDayColumn[];
  routes: {
    bus: string;
    routeName: string;
    campers: BubbleSheetCamper[];
  }[];
}): boolean {
  const built = buildBusBubbleSheetsPdf(options);
  if (!built) return false;
  triggerBlobDownload(built.blob, built.filename);
  return true;
}

export function buildDayBusBubbleSheetPdf(options: {
  companyName: string;
  date: string;
  enrollmentWeek?: number;
  weekDateRange?: string;
  amRoutes: {
    bus: string;
    routeName: string;
    campers: BubbleSheetCamper[];
  }[];
  pmRoutes: {
    bus: string;
    routeName: string;
    campers: BubbleSheetCamper[];
  }[];
}): TransportReportPdf | null {
  const toSections = (
    routes: { bus: string; routeName: string; campers: BubbleSheetCamper[] }[],
    periodLabel: string,
  ): BubbleSheetSection[] =>
    routes
      .filter((r) => r.campers.length > 0)
      .map((r) => ({
        title: `${periodLabel} · ${r.bus} · ${r.routeName}`,
        subtitle: `${r.campers.length} on the bus`,
        campers: r.campers,
      }));

  const amSections = toSections(options.amRoutes, "AM");
  const pmSections = toSections(options.pmRoutes, "PM");
  if (!amSections.length && !pmSections.length) return null;

  const metaLines = [`Date: ${options.date}`];
  if (options.enrollmentWeek != null) metaLines.push(`Enrollment week: ${options.enrollmentWeek}`);
  if (options.weekDateRange) metaLines.push(`Week dates: ${options.weekDateRange}`);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  renderBubbleDocument(
    doc,
    options.companyName,
    "Bus Bubble Sheet",
    metaLines,
    [
      { layout: "daily", sections: amSections, detailColumnLabel: "Stop" },
      { layout: "daily", sections: pmSections, detailColumnLabel: "Stop" },
    ],
    DAY_BUS_INSTRUCTION,
  );

  const safeDate = options.date.replace(/[^0-9-]/g, "");
  return {
    blob: doc.output("blob"),
    filename: `bus-bubble-sheet-${safeDate}.pdf`,
  };
}

export function buildGroupBubbleSheetPdf(options: {
  companyName: string;
  enrollmentWeek: number;
  weekDateRange?: string;
  weekDays: WeekDayColumn[];
  groups: {
    groupName: string;
    campers: BubbleSheetCamper[];
  }[];
}): TransportReportPdf | null {
  const sections = options.groups
    .filter((g) => g.campers.length > 0)
    .map((g) => ({
      title: `Group · ${g.groupName}`,
      subtitle: `${g.campers.length} campers enrolled this week`,
      campers: g.campers,
    }));

  if (!sections.length) return null;

  const metaLines = [`Enrollment Week: ${options.enrollmentWeek}`];
  if (options.weekDateRange) metaLines.push(`Dates: ${options.weekDateRange}`);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  renderBubbleDocument(
    doc,
    options.companyName,
    "Group Attendance Bubble Sheet",
    metaLines,
    [{ layout: "weekly", sections, weekDays: options.weekDays }],
  );

  return {
    blob: doc.output("blob"),
    filename: `group-bubble-sheet-week-${options.enrollmentWeek}.pdf`,
  };
}

export function downloadGroupBubbleSheetPdf(options: {
  companyName: string;
  enrollmentWeek: number;
  weekDateRange?: string;
  weekDays: WeekDayColumn[];
  groups: {
    groupName: string;
    campers: BubbleSheetCamper[];
  }[];
}): boolean {
  const built = buildGroupBubbleSheetPdf(options);
  if (!built) return false;
  triggerBlobDownload(built.blob, built.filename);
  return true;
}

export function buildCombinedAttendanceBubbleSheetPdf(options: {
  companyName: string;
  date: string;
  runPeriod: "am" | "pm";
  enrollmentWeek?: number;
  weekDateRange?: string;
  weekDays?: WeekDayColumn[];
  busRoutes: {
    bus: string;
    routeName: string;
    campers: BubbleSheetCamper[];
  }[];
  groups: {
    groupName: string;
    campers: BubbleSheetCamper[];
  }[];
}): TransportReportPdf | null {
  const busAmPmDays: WeekDayColumn[] = [];
  const baseWeekDays = options.weekDays?.length
    ? options.weekDays.slice(0, 5)
    : [{ label: "Mon" }, { label: "Tue" }, { label: "Wed" }, { label: "Thu" }, { label: "Fri" }];
  for (const day of baseWeekDays) {
    busAmPmDays.push({ label: day.label, sublabel: day.sublabel ? `${day.sublabel} AM` : "AM" });
    busAmPmDays.push({ label: day.label, sublabel: day.sublabel ? `${day.sublabel} PM` : "PM" });
  }

  const busSections: BubbleSheetSection[] = options.busRoutes
    .filter((r) => r.campers.length > 0)
    .map((r) => ({
      title: `${r.bus} · ${r.routeName}`,
      subtitle: `${r.campers.length} campers enrolled this week`,
      campers: r.campers,
    }));

  const groupSections: BubbleSheetSection[] = options.groups
    .filter((g) => g.campers.length > 0)
    .map((g) => ({
      title: `Group · ${g.groupName}`,
      subtitle: `${g.campers.length} campers`,
      campers: g.campers,
    }));

  if (!busSections.length && !groupSections.length) return null;

  const metaLines: string[] = [];
  if (options.enrollmentWeek != null) {
    metaLines.push(`Enrollment Week: ${options.enrollmentWeek}`);
    if (options.weekDateRange) metaLines.push(`Week dates: ${options.weekDateRange}`);
  } else {
    metaLines.push(`Date: ${options.date}`, `Run: ${options.runPeriod.toUpperCase()}`);
  }

  const parts: BubbleSheetPart[] = [];
  if (busSections.length) {
    parts.push({ layout: "weekly", sections: busSections, weekDays: busAmPmDays });
  }
  if (groupSections.length) {
    parts.push({
      layout: "weekly",
      sections: groupSections,
      weekDays: options.weekDays?.length ? options.weekDays.slice(0, 5) : [
        { label: "Mon" },
        { label: "Tue" },
        { label: "Wed" },
        { label: "Thu" },
        { label: "Fri" },
      ],
    });
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  renderBubbleDocument(doc, options.companyName, "Day Camp Attendance Bubble Sheet", metaLines, parts);

  const safeDate = options.date.replace(/[^0-9-]/g, "");
  return {
    blob: doc.output("blob"),
    filename: `daycamp-attendance-bubble-${safeDate}-${options.runPeriod}.pdf`,
  };
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
  const built = buildCombinedAttendanceBubbleSheetPdf(options);
  if (!built) return false;
  triggerBlobDownload(built.blob, built.filename);
  return true;
}
