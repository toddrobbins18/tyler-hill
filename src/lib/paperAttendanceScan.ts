import {
  applyOmrFlagsToRoster,
  findPaperSheetLabelsInText,
  matchPaperSheetLabel,
  mergePaperScannedLabels,
  missingPaperSheets,
  uniquePaperAbsents,
  type PaperAbsentCamper,
  type PaperAttendanceListKind,
} from "@/lib/paperAttendance";
import { decodePaperSheetBarcodeFromImage } from "@/lib/paperAttendanceBarcode";
import {
  analyzePaperAttendanceImage,
  isMostlyBlankImage,
  omrRowsToAbsentFlags,
  type PaperTextItem,
  type RgbaImage,
} from "@/lib/paperAttendanceOmr";

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
  textItems?: PaperTextItem[];
  sourceName: string;
};

export type PaperBatchScanResult = {
  sheets: PaperScannedSheet[];
  unreadPages: PaperScanUnreadPage[];
  scannedLabels: string[];
  missingLabels: string[];
};

function pageLabel(
  page: PaperScanPage,
  kind: PaperAttendanceListKind,
  expectedLabels: string[],
): { label: string; payload: string | null } {
  const payload = page.image ? decodePaperSheetBarcodeFromImage(page.image) : null;
  const fromBarcode = payload ? matchPaperSheetLabel(payload, kind, expectedLabels) : null;
  const fromText = page.pageText
    ? findPaperSheetLabelsInText(page.pageText, expectedLabels, kind)[0] ?? null
    : null;
  return { label: fromBarcode || fromText || "", payload };
}

function mergeSheetPages(sheets: PaperScannedSheet[]): PaperScannedSheet[] {
  const lastByLabel = new Map<string, PaperScannedSheet>();
  for (const sheet of sheets) {
    const prev = lastByLabel.get(sheet.label);
    if (!prev) {
      lastByLabel.set(sheet.label, sheet);
      continue;
    }
    lastByLabel.set(sheet.label, {
      label: sheet.label,
      sourceName: `${prev.sourceName}, ${sheet.sourceName}`,
      warning: prev.warning || sheet.warning,
      absents: uniquePaperAbsents([...prev.absents, ...sheet.absents]),
    });
  }
  return [...lastByLabel.values()];
}

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
  const usedByLabel = new Map<string, number>();
  let lastLabel = "";

  for (const page of pages) {
    const blank = page.image ? isMostlyBlankImage(page.image) : !page.pageText?.trim();
    const found = pageLabel(page, options.kind, options.expectedLabels);
    const label =
      found.label
      || (pages.length === 1 ? options.fallbackLabel?.trim() || "" : "")
      || (!blank && lastLabel ? lastLabel : "");
    if (!label) {
      if (blank) continue;
      if (!(options.extraFoundLabels ?? []).length) {
        unreadPages.push({
          sourceName: page.sourceName,
          reason: found.payload
            ? `Header barcode ${found.payload} is not a ${options.kind} sheet in this season.`
            : "Could not read the bus/group title on this page.",
        });
      }
      continue;
    }
    lastLabel = label;
    identifiedLabels.push(label);
    if (blank) {
      sheets.push({
        label,
        sourceName: page.sourceName,
        absents: [],
      });
      continue;
    }
    const roster = options.rosterForLabel(label);
    const start = usedByLabel.get(label) ?? 0;
    const remaining = roster.slice(start);
    if (!page.image || options.weekdayIndex == null) {
      sheets.push({
        label,
        sourceName: page.sourceName,
        absents: [],
        warning: page.image
          ? undefined
          : "Found this sheet in the PDF. Mark absents by hand if bubbles were not scanned.",
      });
      continue;
    }
    if (!remaining.length) {
      sheets.push({
        label,
        sourceName: page.sourceName,
        absents: [],
        warning: start ? undefined : `No campers on ${label}.`,
      });
      continue;
    }
    const result = analyzePaperAttendanceImage(page.image, {
      kind: options.kind,
      weekdayIndex: options.weekdayIndex,
      camperCount: remaining.length,
      camperNames: remaining.map((camper) => camper.name),
      textItems: page.textItems,
    });
    const flags = omrRowsToAbsentFlags(result.rows, options.kind);
    const marked = applyOmrFlagsToRoster(remaining, flags);
    usedByLabel.set(label, start + (result.detectedRows || 0));
    const absents = marked
      .filter((row) => row.absent)
      .map((row) => ({
        camperId: row.id,
        camperName: row.name,
        sheetLabel: label,
      }));
    const weakAlignment =
      !!result.warning
      && !absents.length
      && result.detectedRows < Math.max(2, remaining.length * 0.6);
    sheets.push({
      label,
      sourceName: page.sourceName,
      warning: weakAlignment ? undefined : result.warning,
      absents,
    });
  }

  const uniqueSheets = mergeSheetPages(sheets);
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
