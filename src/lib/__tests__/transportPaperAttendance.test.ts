import { describe, expect, it } from "vitest";
import {
  applyOmrFlagsToRoster,
  parseChangeSheetAttendanceSource,
  reviewPaperAttendance,
  weekdayBubbleIndex,
} from "@/lib/paperAttendance";
import { encodePaperSheetBarcode } from "@/lib/transportReportPdfLayout";
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
