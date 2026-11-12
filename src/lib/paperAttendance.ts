export type PaperAttendanceListKind = "bus" | "group";
export type ChangeSheetAttendanceSource = "paperless" | "paper_scan";

export type PaperAbsentCamper = {
  camperId?: string | null;
  camperName: string;
  sheetLabel: string;
};

export type PaperConflictReview = {
  confirmed: PaperAbsentCamper[];
  busOnly: PaperAbsentCamper[];
  groupOnly: PaperAbsentCamper[];
};

export const WEEKDAY_BUBBLE_LABELS = ["mo", "tu", "we", "th", "fr"] as const;

export function parseChangeSheetAttendanceSource(
  raw: unknown,
): ChangeSheetAttendanceSource {
  return raw === "paper_scan" ? "paper_scan" : "paperless";
}

export function normPaperCamperName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Monday = 0 … Friday = 4. Weekend sheets are not used. */
export function weekdayBubbleIndex(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay();
  if (day === 0 || day === 6) return null;
  return day - 1;
}

export function uniquePaperAbsents(rows: PaperAbsentCamper[]): PaperAbsentCamper[] {
  const seen = new Set<string>();
  const out: PaperAbsentCamper[] = [];
  for (const row of rows) {
    const key = normPaperCamperName(row.camperName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      camperId: row.camperId ?? null,
      camperName: row.camperName.trim(),
      sheetLabel: row.sheetLabel.trim(),
    });
  }
  return out.sort((a, b) => a.camperName.localeCompare(b.camperName));
}

/**
 * Both lists = really absent. One-sided marks stay as conflicts and do not
 * feed change sheets.
 */
export function reviewPaperAttendance(
  busAbsents: PaperAbsentCamper[],
  groupAbsents: PaperAbsentCamper[],
): PaperConflictReview {
  const bus = uniquePaperAbsents(busAbsents);
  const group = uniquePaperAbsents(groupAbsents);
  const groupByName = new Map(group.map((row) => [normPaperCamperName(row.camperName), row]));
  const busNames = new Set(bus.map((row) => normPaperCamperName(row.camperName)));

  const confirmed: PaperAbsentCamper[] = [];
  const busOnly: PaperAbsentCamper[] = [];
  for (const row of bus) {
    const match = groupByName.get(normPaperCamperName(row.camperName));
    if (match) confirmed.push({ ...row, sheetLabel: `${row.sheetLabel} + ${match.sheetLabel}` });
    else busOnly.push(row);
  }
  const groupOnly = group.filter((row) => !busNames.has(normPaperCamperName(row.camperName)));
  return { confirmed, busOnly, groupOnly };
}

export function applyOmrFlagsToRoster<T extends { name: string }>(
  roster: T[],
  flags: Array<{ camperIndex: number; absent: boolean }>,
): Array<T & { absent: boolean }> {
  const byIndex = new Map(flags.map((row) => [row.camperIndex, row.absent]));
  return roster.map((camper, index) => ({
    ...camper,
    absent: byIndex.get(index) === true,
  }));
}

export function paperSheetKey(label: string): string {
  return label.replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 24);
}

export function decodePaperSheetBarcode(
  payload: string,
): { kind: "bus" | "group"; key: string } | null {
  const raw = paperSheetKey(payload);
  if (raw.length < 2) return null;
  if (raw.startsWith("B")) return { kind: "bus", key: raw.slice(1) };
  if (raw.startsWith("G")) return { kind: "group", key: raw.slice(1) };
  return null;
}

export function matchPaperSheetLabel(
  payload: string,
  kind: "bus" | "group",
  labels: string[],
): string | null {
  const decoded = decodePaperSheetBarcode(payload);
  if (!decoded || decoded.kind !== kind) return null;
  return labels.find((label) => paperSheetKey(label) === decoded.key) ?? null;
}

export function missingPaperSheets(expectedLabels: string[], scannedLabels: string[]): string[] {
  const have = new Set(scannedLabels.map(paperSheetKey));
  return expectedLabels.filter((label) => !have.has(paperSheetKey(label)));
}

export function formatPaperScanChecklist(options: {
  kind: PaperAttendanceListKind;
  scannedLabels: string[];
  missingLabels: string[];
  unreadPages: Array<{ sourceName: string; reason: string }>;
}): string {
  const noun = options.kind === "bus" ? "bus" : "group";
  const parts: string[] = [];
  parts.push(`Read ${options.scannedLabels.length} ${noun} sheet${options.scannedLabels.length === 1 ? "" : "s"}.`);
  if (options.missingLabels.length) {
    parts.push(`Missing: ${options.missingLabels.join(", ")}.`);
  } else if (options.scannedLabels.length) {
    parts.push(`Every ${noun} sheet is in.`);
  }
  if (options.unreadPages.length) {
    parts.push(`Could not read: ${options.unreadPages.map((page) => page.sourceName).join(", ")}.`);
  }
  return parts.join(" ");
}
