import jsPDF from "jspdf";
import type { BubbleSheetCamper } from "@/lib/transportBubbleSheetPdf";
import type { RouteSummaryStopRow } from "@/lib/transportReportData";
import {
  addTransportPdfFooters,
  drawCode39Barcode,
  drawTransportPdfHeader,
  type TransportPdfLogo,
} from "@/lib/transportReportPdfLayout";

export type TransportReportPdf = {
  blob: Blob;
  filename: string;
};

export type GroupReportCamper = {
  name: string;
  demographicsLine: string;
  programLine: string;
  transportLine: string;
  contactsBlock: string;
  /** Person ID or camper id — rendered as Code 39 when set. */
  barcodeValue?: string;
};

const FOOTER = 12;
const DAY_LABELS = ["mo", "tu", "we", "th", "fr"];

function drawDayBubbleHeader(doc: jsPDF, xStart: number, y: number, width: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  const colW = width / DAY_LABELS.length;
  DAY_LABELS.forEach((label, i) => {
    doc.text(label, xStart + colW * i + colW / 2, y, { align: "center" });
  });
  return y + 4;
}

function drawDayBubbles(doc: jsPDF, cxStart: number, cy: number, width: number, radius = 2.2) {
  const colW = width / DAY_LABELS.length;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  DAY_LABELS.forEach((_, i) => {
    const cx = cxStart + colW * i + colW / 2;
    doc.circle(cx, cy, radius, "S");
  });
}

function drawAmPmBubbleHeader(doc: jsPDF, xStart: number, y: number, width: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  const colW = width / DAY_LABELS.length;
  DAY_LABELS.forEach((label, i) => {
    const cx = xStart + colW * i + colW / 2;
    doc.text(label, cx, y, { align: "center" });
    doc.text("AM", cx - 2.5, y + 3.5, { align: "center" });
    doc.text("PM", cx + 2.5, y + 3.5, { align: "center" });
  });
  return y + 8;
}

function drawAmPmBubbles(
  doc: jsPDF,
  cxStart: number,
  cy: number,
  width: number,
  camper: BubbleSheetCamper,
) {
  const colW = width / DAY_LABELS.length;
  const r = 1.8;
  doc.setLineWidth(0.2);
  DAY_LABELS.forEach((_, i) => {
    const cx = cxStart + colW * i + colW / 2;
    const amX = cx - 2.5;
    const pmX = cx + 2.5;
    if (camper.ridesAm !== false) doc.circle(amX, cy, r, "S");
    else {
      doc.circle(amX, cy, r, "S");
      doc.line(amX - r, cy - r, amX + r, cy + r);
    }
    if (camper.ridesPm !== false) doc.circle(pmX, cy, r, "S");
    else {
      doc.circle(pmX, cy, r, "S");
      doc.line(pmX - r, cy - r, pmX + r, cy + r);
    }
  });
}

function drawCamperBlock(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  y: number,
  camper: GroupReportCamper,
  bubbleMode: "daily" | "am-pm",
  bubbleCamper?: BubbleSheetCamper,
): number {
  const bubbleWidth = 38;
  const bubbleX = pageWidth - margin - bubbleWidth;
  const textRight = bubbleX - 4;
  const rowTop = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(camper.name, margin, y + 4);
  if (camper.barcodeValue?.trim()) {
    drawCode39Barcode(doc, margin + 52, y - 1, camper.barcodeValue, {
      heightMm: 5.5,
      narrowMm: 0.28,
      label: false,
    });
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  y += 7;
  doc.text(camper.demographicsLine, margin, y);
  y += 3.5;
  doc.text(camper.programLine, margin, y);
  y += 3.5;
  doc.text(camper.transportLine, margin, y);

  const contactLines = doc.splitTextToSize(camper.contactsBlock, textRight - margin - 8) as string[];
  doc.setFontSize(7);
  let contactY = rowTop + 5;
  for (const line of contactLines.slice(0, 4)) {
    doc.text(line, margin + (textRight - margin) * 0.45, contactY, { align: "center" });
    contactY += 3.2;
  }

  const bubbleY = rowTop + 12;
  if (bubbleMode === "am-pm" && bubbleCamper) {
    drawAmPmBubbles(doc, bubbleX, bubbleY, bubbleWidth, bubbleCamper);
  } else {
    drawDayBubbles(doc, bubbleX, bubbleY, bubbleWidth);
  }

  const rowBottom = Math.max(y + 4, bubbleY + 5);
  doc.setLineWidth(0.12);
  doc.line(margin, rowBottom, pageWidth - margin, rowBottom);
  return rowBottom + 3;
}

export function buildGroupReportPdf(options: {
  companyName: string;
  season: string;
  weekDateRange: string;
  groupName: string;
  totalCampers: number;
  staffNames?: string[];
  campers: GroupReportCamper[];
  logo?: TransportPdfLogo | null;
  printedAt?: Date;
}): TransportReportPdf | null {
  if (!options.campers.length) return null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const usableBottom = pageHeight - FOOTER;
  const printedAt = options.printedAt ?? new Date();

  let y = drawTransportPdfHeader(doc, margin, pageWidth, {
    companyName: options.companyName,
    reportTitle: `Group Report · Summer ${options.season}`,
    metaLines: [options.weekDateRange, `Total Campers: ${options.totalCampers}`],
    subtitle: options.groupName.toUpperCase(),
    logo: options.logo,
    printedAt,
  });

  if (options.staffNames?.length) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Staff: ${options.staffNames.join(", ")}`, margin, y);
    y += 5;
  }

  y = drawDayBubbleHeader(doc, pageWidth - margin - 38, y, 38);
  y += 2;

  for (const camper of options.campers) {
    if (y > usableBottom - 22) {
      doc.addPage();
      y = margin;
      y = drawDayBubbleHeader(doc, pageWidth - margin - 38, y, 38);
      y += 2;
    }
    y = drawCamperBlock(doc, margin, pageWidth, y, camper, "daily");
  }

  addTransportPdfFooters(doc, printedAt);
  const safeGroup = options.groupName.replace(/[^\w-]+/g, "-");
  return {
    blob: doc.output("blob"),
    filename: `group-report-${safeGroup}.pdf`,
  };
}

export function buildBusRosterReportPdf(options: {
  companyName: string;
  season: string;
  weekDateRange: string;
  bus: string;
  routeName: string;
  driverOrCounselor?: string | null;
  totalPassengers: number;
  campers: GroupReportCamper[];
  bubbleCampers: BubbleSheetCamper[];
  logo?: TransportPdfLogo | null;
  printedAt?: Date;
}): TransportReportPdf | null {
  if (!options.campers.length) return null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 12;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const usableBottom = pageHeight - FOOTER;

  const meta = [
    options.weekDateRange,
    `Bus: ${options.bus}`,
    options.routeName,
    `Total Passengers: ${options.totalPassengers}`,
  ];
  if (options.driverOrCounselor) meta.push(`Counselor: ${options.driverOrCounselor}`);

  const printedAt = options.printedAt ?? new Date();
  let y = drawTransportPdfHeader(doc, margin, pageWidth, {
    companyName: options.companyName,
    reportTitle: `Bus Roster Report · Summer ${options.season}`,
    metaLines: meta,
    subtitle: options.bus,
    logo: options.logo,
    printedAt,
  });

  y = drawAmPmBubbleHeader(doc, pageWidth - margin - 38, y, 38);
  y += 2;

  for (let i = 0; i < options.campers.length; i++) {
    const camper = options.campers[i];
    const bubble = options.bubbleCampers[i];
    if (y > usableBottom - 24) {
      doc.addPage();
      y = margin;
      y = drawAmPmBubbleHeader(doc, pageWidth - margin - 38, y, 38);
      y += 2;
    }
    y = drawCamperBlock(doc, margin, pageWidth, y, camper, "am-pm", bubble);
  }

  addTransportPdfFooters(doc, printedAt);
  const safeBus = options.bus.replace(/\s+/g, "-");
  return {
    blob: doc.output("blob"),
    filename: `bus-roster-${safeBus}.pdf`,
  };
}

export function buildBusRouteSummaryPdf(options: {
  companyName: string;
  season: string;
  dateLabel: string;
  rows: RouteSummaryStopRow[];
  logo?: TransportPdfLogo | null;
  printedAt?: Date;
}): TransportReportPdf | null {
  if (!options.rows.length) return null;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const cols = [
    { label: "Route", w: 32 },
    { label: "Bus", w: 18 },
    { label: "Stop #", w: 12 },
    { label: "Stop Name", w: 36 },
    { label: "Address", w: 62 },
    { label: "Time", w: 18 },
    { label: "Passengers", w: 22 },
  ];

  const printedAt = options.printedAt ?? new Date();
  let y = drawTransportPdfHeader(doc, margin, pageWidth, {
    companyName: options.companyName,
    reportTitle: "Bus Route Summary",
    metaLines: [`Season ${options.season}`, options.dateLabel, `${options.rows.length} stops`],
    logo: options.logo,
    printedAt,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  let x = margin;
  const headerBottom = y + 6;
  for (const col of cols) {
    doc.text(col.label, x + 1, y + 4);
    x += col.w;
  }
  doc.line(margin, headerBottom, pageWidth - margin, headerBottom);
  y = headerBottom;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  for (const row of options.rows) {
    if (y > pageHeight - FOOTER - 6) {
      doc.addPage();
      y = margin;
    }
    x = margin;
    const cells = [
      row.routeName,
      row.bus,
      String(row.stopNumber),
      row.stopName,
      row.address,
      row.pickupTime,
      String(row.passengers),
    ];
    for (let i = 0; i < cols.length; i++) {
      const lines = doc.splitTextToSize(cells[i] ?? "", cols[i].w - 2) as string[];
      doc.text(lines[0] ?? "", x + 1, y + 4);
      x += cols[i].w;
    }
    y += 6;
    doc.line(margin, y, pageWidth - margin, y);
  }

  addTransportPdfFooters(doc, printedAt);
  return {
    blob: doc.output("blob"),
    filename: `bus-route-summary-${options.dateLabel.replace(/[^0-9-]/g, "")}.pdf`,
  };
}
