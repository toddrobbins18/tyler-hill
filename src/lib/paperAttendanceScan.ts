import {
  applyOmrFlagsToRoster,
  matchPaperSheetLabel,
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

export type PaperBatchScanResult = {
  sheets: PaperScannedSheet[];
  unreadPages: PaperScanUnreadPage[];
  scannedLabels: string[];
  missingLabels: string[];
};

export function processPaperAttendancePages(
  pages: Array<{ image: RgbaImage; sourceName: string }>,
  options: {
    kind: PaperAttendanceListKind;
    weekdayIndex: number;
    expectedLabels: string[];
    rosterForLabel: (label: string) => PaperScanRosterCamper[];
    fallbackLabel?: string | null;
  },
): PaperBatchScanResult {
  const sheets: PaperScannedSheet[] = [];
  const unreadPages: PaperScanUnreadPage[] = [];

  for (const page of pages) {
    const payload = decodePaperSheetBarcodeFromImage(page.image);
    const matched = payload
      ? matchPaperSheetLabel(payload, options.kind, options.expectedLabels)
      : null;
    const label =
      matched || (pages.length === 1 ? options.fallbackLabel?.trim() || "" : "");
    if (!label) {
      unreadPages.push({
        sourceName: page.sourceName,
        reason: payload
          ? `Header barcode ${payload} is not a ${options.kind} sheet in this season.`
          : "Could not read the header barcode.",
      });
      continue;
    }
    const roster = options.rosterForLabel(label);
    if (!roster.length) {
      unreadPages.push({
        sourceName: page.sourceName,
        reason: `No campers on ${label}.`,
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
  const scannedLabels = uniqueSheets.map((sheet) => sheet.label);

  return {
    sheets: uniqueSheets,
    unreadPages,
    scannedLabels,
    missingLabels: missingPaperSheets(options.expectedLabels, scannedLabels),
  };
}
