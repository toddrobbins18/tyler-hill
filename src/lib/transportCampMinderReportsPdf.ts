import jsPDF from "jspdf";
import type { BubbleSheetCamper } from "@/lib/transportBubbleSheetPdf";
import type { RouteSummaryStopRow } from "@/lib/transportReportData";
import {
  addTransportPdfFooters,
  drawCode39Barcode,
  drawTransportPdfHeader,
  encodePaperSheetBarcode,
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
  addressLine?: string;
  divisionLine?: string;
  town?: string;
  sessionLine?: string;
};

const FOOTER = 12;
const DAY_LABELS = ["mo", "tu", "we", "th", "fr"];

export function groupReportRowColumns(
  pageWidth: number,
  margin: number,
  bubbleMode: "daily" | "am-pm",
  hasBarcode: boolean,
) {
  const gap = 3;
  const bubbleWidth = bubbleMode === "am-pm" ? (hasBarcode ? 58 : 64) : 52;
  const barcodeSlot = hasBarcode ? (bubbleMode === "am-pm" ? 32 : 36) : 0;
  const bubbleX = pageWidth - margin - bubbleWidth;
  const barcodeX = bubbleX - gap - barcodeSlot;
  const textRight = (hasBarcode ? barcodeX : bubbleX) - gap;
  const contactW = Math.min(52, Math.max(34, (textRight - margin) * 0.46));
  const contactX = textRight - contactW;
  return {
    bubbleX,
    bubbleRight: bubbleX + bubbleWidth,
    barcodeX,
    barcodeRight: barcodeX + barcodeSlot,
    textRight,
    contactX,
    contactRight: contactX + contactW,
    leftRight: contactX - gap,
  };
}

function bubbleDayCenters(x: number, width: number, mode: "days" | "am-pm"): number[] {
  const gutter = mode === "am-pm" ? 9 : 0;
  const colW = (width - gutter) / DAY_LABELS.length;
  return DAY_LABELS.map((_, i) => x + gutter + colW * i + colW / 2);
}

function drawCenteredLabel(doc: jsPDF, label: string, centerX: number, baseline: number) {
  const textWidth = doc.getTextWidth(label);
  doc.text(label, centerX - textWidth / 2, baseline);
}

/** One weekday header for the page, sitting above the circle column. */
function drawBubbleDayHeader(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  y: number,
  bubbleMode: "daily" | "am-pm",
): number {
  const columns = groupReportRowColumns(pageWidth, margin, bubbleMode, true);
  const mode = bubbleMode === "am-pm" ? "am-pm" : "days";
  const width = columns.bubbleRight - columns.bubbleX;
  const centers = bubbleDayCenters(columns.bubbleX, width, mode);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(60);
  DAY_LABELS.forEach((label, i) => {
    drawCenteredLabel(doc, label, centers[i], y + 3.2);
  });
  doc.setTextColor(0);
  return y + 5;
}

function drawWeekCircles(doc: jsPDF, centers: number[], cy: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  for (const centerX of centers) {
    doc.circle(centerX, cy, 2, "S");
  }
}

function drawWeekBubbleColumn(
  doc: jsPDF,
  x: number,
  top: number,
  width: number,
  mode: "days" | "am-pm",
): number {
  const centers = bubbleDayCenters(x, width, mode);
  if (mode === "days") {
    drawWeekCircles(doc, centers, top + 3.2);
    return 8;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("AM", x, top + 4);
  drawWeekCircles(doc, centers, top + 3.2);
  doc.text("PM", x, top + 10);
  drawWeekCircles(doc, centers, top + 9.2);
  return 14;
}

function drawCamperBlock(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  y: number,
  camper: GroupReportCamper,
  bubbleMode: "daily" | "am-pm",
): number {
  const showBarcode = !!camper.barcodeValue?.trim();
  const columns = groupReportRowColumns(pageWidth, margin, bubbleMode, true);
  const { bubbleX, barcodeX, contactX } = columns;
  const bubbleWidth = columns.bubbleRight - bubbleX;
  const contactW = columns.contactRight - contactX;
  const leftW = columns.leftRight - margin;
  const barcodeSlot = showBarcode ? columns.barcodeRight - barcodeX : 0;
  const rowTop = y;
  const nameLine = `${camper.name}${camper.demographicsLine ? ` ${camper.demographicsLine}` : ""}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const nameLines = (doc.splitTextToSize(nameLine, leftW) as string[]).slice(0, 2);
  let cursor = y + 4;
  for (const line of nameLines) {
    doc.text(line, margin, cursor);
    cursor += 3.8;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const sessionBits = [camper.sessionLine || camper.programLine, camper.divisionLine]
    .map((line) => line?.trim())
    .filter((line, index, all): line is string => !!line && line !== "—" && all.indexOf(line) === index);
  const detailLines = [
    camper.addressLine,
    camper.addressLine?.trim() ? "" : camper.town,
    sessionBits.join(" · "),
    camper.transportLine,
  ].filter(
    (line): line is string => !!line && line.trim() !== "" && line !== "—",
  );
  let textY = cursor + 0.4;
  let leftCount = 0;
  for (const source of detailLines) {
    if (leftCount >= 3) break;
    const wrapped = doc.splitTextToSize(source, leftW) as string[];
    for (const line of wrapped) {
      if (leftCount >= 3) break;
      doc.text(line, margin, textY);
      textY += 3.3;
      leftCount += 1;
    }
  }

  const contactSource = camper.contactsBlock.trim() === "—" ? "" : camper.contactsBlock;
  const contactLines = contactSource
    ? (doc.splitTextToSize(contactSource, contactW) as string[]).slice(0, 5)
    : [];
  let contactY = cursor + 0.6;
  for (const line of contactLines) {
    doc.text(line, contactX, contactY);
    contactY += 3.3;
  }

  if (showBarcode && camper.barcodeValue) {
    drawCode39Barcode(doc, barcodeX, rowTop + 2, camper.barcodeValue, {
      heightMm: 8,
      narrowMm: 0.28,
      maxWidthMm: barcodeSlot,
      label: false,
    });
  }

  const bubbleHeight = drawWeekBubbleColumn(
    doc,
    bubbleX,
    rowTop + 1.2,
    bubbleWidth,
    bubbleMode === "am-pm" ? "am-pm" : "days",
  );

  const rowBottom = Math.max(textY, contactY, rowTop + Math.max(bubbleHeight, showBarcode ? 12 : 0)) + 1.5;
  doc.setDrawColor(210);
  doc.setLineWidth(0.15);
  doc.line(margin, rowBottom, pageWidth - margin, rowBottom);
  doc.setDrawColor(0);
  return rowBottom + 2.5;
}

export function buildGroupReportPdf(options: {
  companyName: string;
  season: string;
  weekDateRange: string;
  groupName: string;
  totalCampers: number;
  staffNames?: string[];
  capacity?: number | null;
  sessionSummary?: string | null;
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
    sheetBarcode: encodePaperSheetBarcode("group", options.groupName),
    logo: options.logo,
    printedAt,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (options.staffNames?.length) {
    doc.text(`Staff List: ${options.staffNames.join(", ")}`, margin, y);
    y += 4;
  }
  if (options.capacity != null) {
    doc.text(`Capacity: ${options.capacity}`, margin, y);
    y += 4;
  }
  const sessionSummary = options.sessionSummary?.trim();
  doc.text(
    `Total Campers: ${options.totalCampers}${sessionSummary ? `; Sessions: ${sessionSummary}` : ""}`,
    margin,
    y,
  );
  y += 5;
  y = drawBubbleDayHeader(doc, margin, pageWidth, y, "daily");

  for (const camper of options.campers) {
    if (y > usableBottom - 28) {
      doc.addPage();
      y = margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${options.groupName.toUpperCase()} (continued)`, margin, y + 4);
      y += 8;
      y = drawBubbleDayHeader(doc, margin, pageWidth, y, "daily");
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

  const crew = options.driverOrCounselor?.trim() ?? "";
  const [driverName, ...escortNames] = crew.split(/\s*[·,/]\s*/).filter(Boolean);
  const meta = [
    options.weekDateRange,
    options.routeName ? options.routeName : "",
    driverName ? `Driver: ${driverName}` : "Driver: —",
    `Escorts: ${escortNames.join(", ") || "—"}`,
    `Total Passengers: ${options.totalPassengers}`,
  ].filter(Boolean);

  const printedAt = options.printedAt ?? new Date();
  let y = drawTransportPdfHeader(doc, margin, pageWidth, {
    companyName: options.companyName,
    reportTitle: `Bus Roster Report · Summer ${options.season}`,
    metaLines: meta,
    subtitle: options.bus,
    sheetBarcode: encodePaperSheetBarcode("bus", options.bus),
    logo: options.logo,
    printedAt,
  });

  y = drawBubbleDayHeader(doc, margin, pageWidth, y, "am-pm");

  for (let i = 0; i < options.campers.length; i++) {
    const camper = options.campers[i];
    if (y > usableBottom - 32) {
      doc.addPage();
      y = margin;
      y = drawBubbleDayHeader(doc, margin, pageWidth, y, "am-pm");
    }
    y = drawCamperBlock(doc, margin, pageWidth, y, camper, "am-pm");
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
  const buses = [...new Set(options.rows.map((row) => row.bus))];
  let y = drawTransportPdfHeader(doc, margin, pageWidth, {
    companyName: options.companyName,
    reportTitle: "Bus Route Summary",
    metaLines: [`Summer ${options.season}`, options.dateLabel, `${options.rows.length} stops`],
    subtitle: buses.length === 1 ? buses[0] : undefined,
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
  const busSlug = buses.length === 1 ? buses[0].replace(/\s+/g, "-") : "buses";
  return {
    blob: doc.output("blob"),
    filename: `bus-route-summary-${busSlug}.pdf`,
  };
}
