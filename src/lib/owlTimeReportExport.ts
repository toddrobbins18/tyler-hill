import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import {
  formatOwlTimeCampClock,
  owlTimeRowsToCsv,
  owlTimeStatusLabel,
  type AttendanceDetailRow,
  type AttendanceSummaryRow,
  type DailyRollCallRow,
  type SignInOutHistoryRow,
} from "@/lib/owlTimeAttendance";

export type OwlTimeExportFormat = "csv" | "pdf" | "xlsx";

export type OwlTimeReportKind = "summary" | "daily" | "detail" | "history";

export type OwlTimeReportDataset = {
  kind: OwlTimeReportKind;
  title: string;
  subtitle: string;
  season: string;
  dateLabel: string;
  headers: string[];
  rows: (string | number)[][];
  meta?: { label: string; value: string }[];
};

const FORMAT_META: Record<
  OwlTimeExportFormat,
  { label: string; description: string; extension: string; mime: string }
> = {
  csv: {
    label: "CSV",
    description: "Spreadsheet-friendly · opens in Excel or Google Sheets",
    extension: "csv",
    mime: "text/csv;charset=utf-8;",
  },
  pdf: {
    label: "PDF",
    description: "Print-ready report with Owl Time branding",
    extension: "pdf",
    mime: "application/pdf",
  },
  xlsx: {
    label: "Excel",
    description: "Native .xlsx workbook with formatted columns",
    extension: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

export function owlTimeExportFormatMeta(format: OwlTimeExportFormat) {
  return FORMAT_META[format];
}

export function buildSummaryDataset(
  rows: AttendanceSummaryRow[],
  season: string,
  dateLabel: string,
  periodLabel: string,
): OwlTimeReportDataset {
  return {
    kind: "summary",
    title: "Attendance Summary",
    subtitle: `${periodLabel} · Season ${season}`,
    season,
    dateLabel,
    headers: [
      "Staff Name",
      "Scheduled Days",
      "Days Signed In",
      "Days Missing",
      "Days Late",
      "Days On Time",
      "Attendance %",
      "Total Minutes Late",
    ],
    rows: rows.map((row) => [
      row.staffName,
      row.scheduledDays,
      row.daysSignedIn,
      row.daysMissing,
      row.daysLate,
      row.daysOnTime,
      `${row.attendancePct}%`,
      row.totalMinutesLate,
    ]),
    meta: [{ label: "Staff count", value: String(rows.length) }],
  };
}

export function buildDailyRollCallDataset(
  rows: DailyRollCallRow[],
  season: string,
  date: string,
  periodLabel: string,
): OwlTimeReportDataset {
  const onTime = rows.filter((r) => r.status === "on_time").length;
  const late = rows.filter((r) => r.status === "late").length;
  const missing = rows.filter((r) => r.status === "missing").length;

  return {
    kind: "daily",
    title: "Daily Roll Call",
    subtitle: `${periodLabel} · Season ${season}`,
    season,
    dateLabel: date,
    headers: ["Date", "Staff Name", "Sign-In", "Status", "Minutes Late"],
    rows: rows.map((row) => [
      row.date,
      row.staffName,
      row.signedInAt ? formatOwlTimeCampClock(row.signedInAt) : "",
      owlTimeStatusLabel(row.status),
      row.minutesLate,
    ]),
    meta: [
      { label: "On time", value: String(onTime) },
      { label: "Late", value: String(late) },
      { label: "Missing", value: String(missing) },
    ],
  };
}

export function buildDetailDataset(
  rows: AttendanceDetailRow[],
  staffName: string,
  season: string,
  dateLabel: string,
  periodLabel: string,
): OwlTimeReportDataset {
  return {
    kind: "detail",
    title: "Attendance Detail",
    subtitle: `${staffName} · ${periodLabel} · Season ${season}`,
    season,
    dateLabel,
    headers: ["Staff Name", "Date", "Sign-In", "Status", "Minutes Late"],
    rows: rows.map((row) => [
      staffName,
      format(parseISO(row.date), "EEE, MMM d, yyyy"),
      row.signedInAt ? formatOwlTimeCampClock(row.signedInAt) : "",
      owlTimeStatusLabel(row.status),
      row.minutesLate,
    ]),
    meta: [{ label: "Days shown", value: String(rows.length) }],
  };
}

export function buildHistoryDataset(
  rows: SignInOutHistoryRow[],
  staffName: string,
  season: string,
  dateLabel: string,
  periodLabel: string,
): OwlTimeReportDataset {
  return {
    kind: "history",
    title: "Sign-In/Out History",
    subtitle: `${staffName} · ${periodLabel} · Season ${season}`,
    season,
    dateLabel,
    headers: [
      "Staff Name",
      "Date",
      "Sign-In",
      "Sign-Out",
      "Total Hours",
      "Late",
      "Minutes Late",
      "Early Departure",
    ],
    rows: rows.map((row) => [
      staffName,
      format(parseISO(row.date), "EEE, MMM d, yyyy"),
      row.signedInAt ? formatOwlTimeCampClock(row.signedInAt) : "",
      row.signedOutAt ? formatOwlTimeCampClock(row.signedOutAt) : "",
      row.totalHours != null ? row.totalHours.toFixed(2) : "",
      row.isLate ? "Yes" : "No",
      row.minutesLate,
      row.isEarlyDeparture ? "Yes" : "No",
    ]),
    meta: [{ label: "Punch days", value: String(rows.length) }],
  };
}

export function owlTimeExportFilename(dataset: OwlTimeReportDataset, format: OwlTimeExportFormat): string {
  const ext = FORMAT_META[format].extension;
  return `owl-time-${dataset.kind}-${dataset.season}-${dataset.dateLabel}.${ext}`;
}

function buildPdfBlob(dataset: OwlTimeReportDataset): Blob {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  doc.setFillColor(12, 122, 236);
  doc.rect(0, 0, pageWidth, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Owl Time", margin, 10);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(dataset.title, margin, 16);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.text(dataset.subtitle, margin, 28);

  let metaY = 33;
  if (dataset.meta?.length) {
    const metaLine = dataset.meta.map((m) => `${m.label}: ${m.value}`).join("   ·   ");
    doc.setTextColor(100, 116, 139);
    doc.text(metaLine, margin, metaY);
    metaY += 6;
  }

  autoTable(doc, {
    head: [dataset.headers],
    body: dataset.rows.map((row) => row.map(String)),
    startY: metaY + 2,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [12, 122, 236],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageNumber = data.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generated ${new Date().toLocaleString("en-US")} · Page ${pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: "center" },
      );
    },
  });

  return doc.output("blob");
}

function buildXlsxBlob(dataset: OwlTimeReportDataset): Blob {
  const sheetRows = [dataset.headers, ...dataset.rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet["!cols"] = dataset.headers.map((header) => ({
    wch: Math.max(header.length + 2, 14),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, dataset.title.slice(0, 31));
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], { type: FORMAT_META.xlsx.mime });
}

function buildCsvBlob(dataset: OwlTimeReportDataset): Blob {
  const csv = owlTimeRowsToCsv(dataset.headers, dataset.rows);
  return new Blob([csv], { type: FORMAT_META.csv.mime });
}

export function buildOwlTimeExportBlob(
  format: OwlTimeExportFormat,
  dataset: OwlTimeReportDataset,
): { blob: Blob; filename: string; previewKind: "pdf" | "table" } {
  const filename = owlTimeExportFilename(dataset, format);

  if (format === "pdf") {
    return { blob: buildPdfBlob(dataset), filename, previewKind: "pdf" };
  }
  if (format === "xlsx") {
    return { blob: buildXlsxBlob(dataset), filename, previewKind: "table" };
  }
  return { blob: buildCsvBlob(dataset), filename, previewKind: "table" };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
