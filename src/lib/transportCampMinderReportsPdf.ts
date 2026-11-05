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
  addressLine?: string;
  divisionLine?: string;
  town?: string;
  sessionLine?: string;
};

const FOOTER = 12;
const DAY_LABELS = ["mo", "tu", "we", "th", "fr"];

function drawWeekBubbleColumn(
  doc: jsPDF,
  x: number,
  top: number,
  width: number,
  mode: "days" | "am-pm",
): number {
  const labelW = mode === "am-pm" ? 8 : 0;
  const gridX = x + labelW;
  const gridW = width - labelW;
  const colW = gridW / DAY_LABELS.length;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  DAY_LABELS.forEach((label, i) => {
    doc.text(label, gridX + colW * i + colW / 2, top + 3, { align: "center" });
  });
  const drawRow = (cy: number) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.25);
    DAY_LABELS.forEach((_, i) => {
      doc.circle(gridX + colW * i + colW / 2, cy, 2.1, "S");
    });
  };
  if (mode === "days") {
    drawRow(top + 8);
    return 14;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("AM", x + 1, top + 9);
  drawRow(top + 8.2);
  doc.text("PM", x + 1, top + 15);
  drawRow(top + 14.2);
  return 20;
}

function drawCamperBlock(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  y: number,
  camper: GroupReportCamper,
  bubbleMode: "daily" | "am-pm",
): number {
  const bubbleWidth = bubbleMode === "am-pm" ? 52 : 42;
  const bubbleX = pageWidth - margin - bubbleWidth;
  const rowTop = y;
  const nameLine = `${camper.name}${camper.demographicsLine ? ` ${camper.demographicsLine}` : ""}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(nameLine, margin, y + 4);
  if (bubbleMode === "daily" && camper.barcodeValue?.trim()) {
    drawCode39Barcode(doc, bubbleX - 28, y - 1, camper.barcodeValue, {
      heightMm: 6,
      narrowMm: 0.26,
      label: false,
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  let textY = y + 8;
  const leftLines = [
    camper.addressLine,
    camper.sessionLine || camper.programLine,
    camper.divisionLine,
    camper.town,
    camper.transportLine,
  ].filter((line): line is string => !!line && line !== "—");
  for (const line of leftLines.slice(0, 4)) {
    doc.text(line, margin, textY);
    textY += 3.4;
  }

  const contactX = margin + 78;
  const contactLines = (doc.splitTextToSize(camper.contactsBlock, 55) as string[]).slice(0, 6);
  let contactY = rowTop + 8;
  for (const line of contactLines) {
    doc.text(line, contactX, contactY);
    contactY += 3.3;
  }

  const bubbleHeight = drawWeekBubbleColumn(
    doc,
    bubbleX,
    rowTop + 1,
    bubbleWidth,
    bubbleMode === "am-pm" ? "am-pm" : "days",
  );

  const rowBottom = Math.max(textY, contactY, rowTop + bubbleHeight) + 2;
  doc.setDrawColor(180);
  doc.setLineWidth(0.15);
  doc.line(margin, rowBottom, pageWidth - margin, rowBottom);
  doc.setDrawColor(0);
  return rowBottom + 3;
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
  y += 6;

  for (const camper of options.campers) {
    if (y > usableBottom - 28) {
      doc.addPage();
      y = margin;
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
    logo: options.logo,
    printedAt,
  });

  for (let i = 0; i < options.campers.length; i++) {
    const camper = options.campers[i];
    if (y > usableBottom - 28) {
      doc.addPage();
      y = margin;
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
