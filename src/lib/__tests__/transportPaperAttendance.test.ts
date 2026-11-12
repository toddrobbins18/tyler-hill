import { describe, expect, it } from "vitest";
import {
  applyOmrFlagsToRoster,
  decodePaperSheetBarcode,
  formatPaperScanChecklist,
  matchPaperSheetLabel,
  missingPaperSheets,
  parseChangeSheetAttendanceSource,
  reviewPaperAttendance,
  weekdayBubbleIndex,
} from "@/lib/paperAttendance";
import { decodePaperSheetBarcodeFromImage, rasterCode39 } from "@/lib/paperAttendanceBarcode";
import { extractJpegBuffersFromPdf } from "@/lib/paperAttendanceImage";
import { processPaperAttendancePages } from "@/lib/paperAttendanceScan";
import { encodeCamperBarcode, encodePaperSheetBarcode } from "@/lib/transportReportPdfLayout";
import { groupReportRowColumns } from "@/lib/transportCampMinderReportsPdf";
import {
  analyzePaperAttendanceImage,
  omrRowsToAbsentFlags,
  type RgbaImage,
} from "@/lib/paperAttendanceOmr";
import {
  buildApprovedChangeSheetRows,
} from "@/lib/transportChangeSheets";
import { attendanceRecordKey } from "@/lib/transportBusAttendance";

function makeWhite(width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);
  return { width, height, data };
}

function fillCircle(image: RgbaImage, cx: number, cy: number, r: number, gray: number) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
    for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = (y * image.width + x) * 4;
      image.data[i] = gray;
      image.data[i + 1] = gray;
      image.data[i + 2] = gray;
      image.data[i + 3] = 255;
    }
  }
}

function strokeCircle(image: RgbaImage, cx: number, cy: number, r: number) {
  const outer = r * r;
  const inner = (r - 2) * (r - 2);
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
    for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d > outer || d < inner) continue;
      const i = (y * image.width + x) * 4;
      image.data[i] = 0;
      image.data[i + 1] = 0;
      image.data[i + 2] = 0;
      image.data[i + 3] = 255;
    }
  }
}

const routeMeta = [{ id: 3, name: "Route East", bus: "Bus 3" }];
const coreStops = {
  3: [
    {
      name: "Smith house",
      address: "10 Oak St",
      lat: 40.88,
      lng: -73.64,
      pickupTime: "7:15 AM",
      passengers: 1,
      camperNames: ["Jamie Smith"],
    },
  ],
};

describe("paper attendance", () => {
  it("maps weekdays to bubble columns", () => {
    expect(weekdayBubbleIndex("2026-07-08")).toBe(2);
    expect(weekdayBubbleIndex("2026-07-11")).toBeNull();
  });

  it("treats both lists as confirmed and one-sided as conflicts", () => {
    const review = reviewPaperAttendance(
      [
        { camperName: "Jamie Smith", sheetLabel: "Bus 3" },
        { camperName: "Alex Lee", sheetLabel: "Bus 7" },
      ],
      [
        { camperName: "Jamie Smith", sheetLabel: "Barcelona" },
        { camperName: "Sam Kim", sheetLabel: "Barcelona" },
      ],
    );
    expect(review.confirmed.map((r) => r.camperName)).toEqual(["Jamie Smith"]);
    expect(review.busOnly.map((r) => r.camperName)).toEqual(["Alex Lee"]);
    expect(review.groupOnly.map((r) => r.camperName)).toEqual(["Sam Kim"]);
  });

  it("defaults change-sheet source to paperless", () => {
    expect(parseChangeSheetAttendanceSource(undefined)).toBe("paperless");
    expect(parseChangeSheetAttendanceSource("paper_scan")).toBe("paper_scan");
  });

  it("encodes sheet barcodes for bus and group", () => {
    expect(encodePaperSheetBarcode("bus", "Bus 3")).toBe("BBUS3");
    expect(encodePaperSheetBarcode("group", "Barcelona")).toBe("GBARCELONA");
  });

  it("ties camper barcodes to CampMinder person ids", () => {
    expect(encodeCamperBarcode("22032198")).toBe("22032198");
    expect(decodePaperSheetBarcode("BBUS3")).toEqual({ kind: "bus", key: "BUS3" });
    expect(matchPaperSheetLabel("BBUS3", "bus", ["Bus 1", "Bus 3"])).toBe("Bus 3");
    expect(matchPaperSheetLabel("GBARCELONA", "bus", ["Bus 3", "Barcelona"])).toBeNull();
    const header = makeWhite(480, 90);
    rasterCode39(header, 200, 20, "BBUS3", { narrow: 1, height: 28 });
    expect(decodePaperSheetBarcodeFromImage(header)).toBe("BBUS3");
  });

  it("lists missing sheets after a combined scan", () => {
    expect(missingPaperSheets(["Bus 3", "Bus 5", "Bus 7"], ["Bus 3", "Bus 7"])).toEqual(["Bus 5"]);
    expect(
      formatPaperScanChecklist({
        kind: "bus",
        scannedLabels: ["Bus 3", "Bus 7"],
        missingLabels: ["Bus 5"],
        unreadPages: [],
      }),
    ).toContain("Missing: Bus 5");
  });

  it("keeps am-pm columns from overlapping when barcodes are on", () => {
    const cols = groupReportRowColumns(215.9, 12, "am-pm", true);
    expect(cols.leftRight).toBeLessThanOrEqual(cols.contactX);
    expect(cols.contactRight).toBeLessThanOrEqual(cols.barcodeX);
    expect(cols.barcodeRight).toBeLessThanOrEqual(cols.bubbleX);
    expect(cols.bubbleRight).toBeLessThanOrEqual(215.9 - 12);
    expect(cols.leftRight - 12).toBeGreaterThanOrEqual(40);
  });

  it("reads filled Wednesday bubbles on a group sheet", () => {
    const image = makeWhite(240, 360);
    const colW = (240 * 0.38) / 5;
    const x0 = 240 * 0.62;
    const rowsY = [80, 160, 240];
    for (const y of rowsY) {
      for (let c = 0; c < 5; c += 1) {
        const cx = x0 + colW * c + colW / 2;
        if (c === 2 && (y === 80 || y === 240)) fillCircle(image, cx, y, 7, 0);
        else strokeCircle(image, cx, y, 7);
      }
    }
    const result = analyzePaperAttendanceImage(image, {
      kind: "group",
      weekdayIndex: 2,
      camperCount: 3,
    });
    const flags = omrRowsToAbsentFlags(result.rows, "group");
    const roster = applyOmrFlagsToRoster(
      [{ name: "A" }, { name: "B" }, { name: "C" }],
      flags,
    );
    expect(roster.map((r) => r.absent)).toEqual([true, false, true]);
  });

  it("reads AM/PM marks on a bus sheet as one row per camper", () => {
    const width = 240;
    const height = 360;
    const image = makeWhite(width, height);
    const pageRight = width * 0.945;
    const bubbleW = width * (58 / 215.9);
    const bubbleX = pageRight - bubbleW;
    const gutter = bubbleW * (9 / 58);
    const colW = (bubbleW - gutter) / 5;
    const blocks = [
      { top: 70, am: true, pm: false },
      { top: 150, am: false, pm: false },
      { top: 230, am: false, pm: true },
    ];
    for (const block of blocks) {
      for (let c = 0; c < 5; c += 1) {
        const cx = bubbleX + gutter + colW * c + colW / 2;
        const amY = block.top + 12;
        const pmY = block.top + 32;
        if (c === 2 && block.am) fillCircle(image, cx, amY, 6, 0);
        else strokeCircle(image, cx, amY, 6);
        if (c === 2 && block.pm) fillCircle(image, cx, pmY, 6, 0);
        else strokeCircle(image, cx, pmY, 6);
      }
    }
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 2,
      camperCount: 3,
    });
    const flags = omrRowsToAbsentFlags(result.rows, "bus");
    const roster = applyOmrFlagsToRoster(
      [{ name: "A" }, { name: "B" }, { name: "C" }],
      flags,
    );
    expect(result.expectedRows).toBe(3);
    expect(roster.map((r) => r.absent)).toEqual([true, false, true]);
  });

  it("reads header barcodes and flags a missing bus sheet", () => {
    const makePage = (payload: string, fillFirst: boolean) => {
      const image = makeWhite(420, 360);
      rasterCode39(image, 168, 12, payload, { narrow: 1, height: 28 });
      const pageRight = 420 * 0.945;
      const bubbleW = 420 * (58 / 215.9);
      const bubbleX = pageRight - bubbleW;
      const gutter = bubbleW * (9 / 58);
      const colW = (bubbleW - gutter) / 5;
      const cx = bubbleX + gutter + colW * 2 + colW / 2;
      if (fillFirst) fillCircle(image, cx, 82, 7, 0);
      else strokeCircle(image, cx, 82, 7);
      strokeCircle(image, cx, 102, 7);
      return image;
    };
    const batch = processPaperAttendancePages(
      [
        { image: makePage("BBUS3", true), sourceName: "page-bus3" },
        { image: makePage("BBUS7", false), sourceName: "page-bus7" },
      ],
      {
        kind: "bus",
        weekdayIndex: 2,
        expectedLabels: ["Bus 3", "Bus 5", "Bus 7"],
        rosterForLabel: (label) => [{ id: label, name: `${label} camper` }],
      },
    );
    expect(batch.scannedLabels.sort()).toEqual(["Bus 3", "Bus 7"]);
    expect(batch.missingLabels).toEqual(["Bus 5"]);
    expect(batch.sheets.find((s) => s.label === "Bus 3")?.absents.map((r) => r.camperName)).toEqual([
      "Bus 3 camper",
    ]);
    expect(batch.sheets.find((s) => s.label === "Bus 7")?.absents).toEqual([]);
  });

  it("pulls page JPEGs out of a copier PDF", () => {
    const jpeg = new Uint8Array(9000);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[8998] = 0xff;
    jpeg[8999] = 0xd9;
    const pdf = new Uint8Array(20 + jpeg.length);
    pdf.set([0x25, 0x50, 0x44, 0x46], 0);
    pdf.set(jpeg, 10);
    expect(extractJpegBuffersFromPdf(pdf)).toHaveLength(1);
  });

  it("uses paper-scan confirmed names instead of electronic bus attendance", () => {
    const rows = buildApprovedChangeSheetRows({
      overrideDate: "2026-07-08",
      runPeriod: "am",
      exceptions: [],
      manual: { excluded: {}, added: {} },
      routeMeta,
      coreStops,
      selectedRouteIds: [3],
      attendanceSource: "paper_scan",
      paperConfirmedAbsents: [{ camperName: "Jamie Smith" }],
      busAttendance: {
        [attendanceRecordKey(3, "Jamie Smith")]: "present",
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      camper: "Jamie Smith",
      source: "Paper scan",
      description: "Confirmed absent (bus + group)",
    });
  });

  it("does not auto-push paperless absents when the source is paper scan", () => {
    const rows = buildApprovedChangeSheetRows({
      overrideDate: "2026-07-08",
      runPeriod: "am",
      exceptions: [],
      manual: { excluded: {}, added: {} },
      routeMeta,
      coreStops,
      selectedRouteIds: [3],
      attendanceSource: "paper_scan",
      paperConfirmedAbsents: [],
      busAttendance: {
        [attendanceRecordKey(3, "Jamie Smith")]: "absent",
      },
    });
    expect(rows.filter((r) => r.camper === "Jamie Smith")).toHaveLength(0);
  });
});
