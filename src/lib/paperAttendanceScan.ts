import {
  applyOmrFlagsToRoster,
  findPaperSheetLabelsInText,
  matchPaperSheetLabel,
  mergePaperScannedLabels,
  missingPaperSheets,
  type PaperAbsentCamper,
  type PaperAttendanceListKind,
} from "@/lib/paperAttendance";
import { decodePaperSheetBarcodeFromImage } from "@/lib/paperAttendanceBarcode";
import { analyzePaperAttendanceImage, omrRowsToAbsentFlags, type RgbaImage } from "@/lib/paperAttendanceOmr";

export type PaperScanRosterCamper = { id: string; name: string };

export type PaperScanUnreadPage = { sourceName: string; reason: string };

export type PaperScannedSheet = {
  label: string;
  absents: PaperAbsentCamper[];
  warning?: string;
  sourceName: string;
};

export type PaperScanPage = {
  image?: RgbaImage;
  pageText?: string;
  sourceName: string;
};

export type PaperBatchScanResult = {
  sheets: PaperScannedSheet[];
  unreadPages: PaperScanUnreadPage[];
  scannedLabels: string[];
  missingLabels: string[];
};

export function processPaperAttendancePages(
  pages: PaperScanPage[],
  options: {
    kind: PaperAttendanceListKind;
    weekdayIndex: number | null;
    expectedLabels: string[];
    rosterForLabel: (label: string) => PaperScanRosterCamper[];
    fallbackLabel?: string | null;
    extraFoundLabels?: string[];
  },
): PaperBatchScanResult {
  const sheets: PaperScannedSheet[] = [];
  const unreadPages: PaperScanUnreadPage[] = [];
  const identifiedLabels: string[] = [];

  for (const page of pages) {
    const payload = page.image ? decodePaperSheetBarcodeFromImage(page.image) : null;
    const fromBarcode = payload
      ? matchPaperSheetLabel(payload, options.kind, options.expectedLabels)
      : null;
    const fromText = page.pageText
      ? findPaperSheetLabelsInText(page.pageText, options.expectedLabels, options.kind)[0] ?? null
      : null;
    const label =
      fromBarcode
      || fromText
      || (pages.length === 1 ? options.fallbackLabel?.trim() || "" : "");
    if (!label) {
      unreadPages.push({
        sourceName: page.sourceName,
        reason: payload
          ? `Header barcode ${payload} is not a ${options.kind} sheet in this season.`
          : "Could not read the bus/group title on this page.",
      });
      continue;
    }
    identifiedLabels.push(label);
    const roster = options.rosterForLabel(label);
    if (!page.image || options.weekdayIndex == null) {
      sheets.push({
        label,
        sourceName: page.sourceName,
        absents: [],
        warning: page.image ? undefined : "Found this sheet in the PDF. Mark absents by hand if bubbles were not scanned.",
      });
      continue;
    }
    if (!roster.length) {
      sheets.push({
        label,
        sourceName: page.sourceName,
        absents: [],
        warning: `No campers on ${label}.`,
      });
      continue;
    }
    const result = analyzePaperAttendanceImage(page.image, {
      kind: options.kind,
      weekdayIndex: options.weekdayIndex,
      camperCount: roster.length,
    });
    const flags = omrRowsToAbsentFlags(result.rows, options.kind);
    const marked = applyOmrFlagsToRoster(roster, flags);
    sheets.push({
      label,
      sourceName: page.sourceName,
      warning: result.warning,
      absents: marked
        .filter((row) => row.absent)
        .map((row) => ({
          camperId: row.id,
          camperName: row.name,
          sheetLabel: label,
        })),
    });
  }

  const lastByLabel = new Map<string, PaperScannedSheet>();
  for (const sheet of sheets) lastByLabel.set(sheet.label, sheet);
  const uniqueSheets = [...lastByLabel.values()];
  const scannedLabels = mergePaperScannedLabels(
    uniqueSheets.map((sheet) => sheet.label),
    identifiedLabels,
    options.extraFoundLabels ?? [],
  );

  return {
    sheets: uniqueSheets,
    unreadPages,
    scannedLabels,
    missingLabels: missingPaperSheets(options.expectedLabels, scannedLabels),
  };
}
