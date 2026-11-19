import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import {
  applyOmrFlagsToRoster,
  decodePaperSheetBarcode,
  findPaperSheetLabelsInText,
  unreadPaperSheetReason,
  formatPaperScanChecklist,
  formatUsAttendanceDate,
  matchPaperSheetLabel,
  missingPaperSheets,
  parseChangeSheetAttendanceSource,
  reviewPaperAttendance,
  weekdayBubbleIndex,
} from "@/lib/paperAttendance";
import {
  decodePaperSheetBarcodeFromImage,
  rasterCode39,
  uprightPaperScanImage,
} from "@/lib/paperAttendanceBarcode";
import {
  extractFlateDctJpegBuffers,
  extractJpegBuffersFromPdf,
  pdfUsesMixedRasterContent,
} from "@/lib/paperAttendanceImage";
import { extractPdfLiteralStrings } from "@/lib/paperAttendancePdfText";
import { processPaperAttendancePages } from "@/lib/paperAttendanceScan";
import { encodeCamperBarcode, encodePaperSheetBarcode } from "@/lib/transportReportPdfLayout";
import { groupReportRowColumns } from "@/lib/transportCampMinderReportsPdf";
import {
  analyzePaperAttendanceImage,
  flipRgbaVertical,
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

function inkPixel(image: RgbaImage, x: number, y: number) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  image.data[i] = 0;
  image.data[i + 1] = 0;
  image.data[i + 2] = 0;
  image.data[i + 3] = 255;
}

function drawX(image: RgbaImage, cx: number, cy: number, r: number) {
  for (let i = -r + 1; i <= r - 1; i += 1) {
    for (const t of [-1, 0, 1]) {
      inkPixel(image, Math.round(cx + i + t), Math.round(cy + i));
      inkPixel(image, Math.round(cx + i + t), Math.round(cy - i));
    }
  }
}

function drawCheck(image: RgbaImage, cx: number, cy: number, r: number) {
  for (let i = 0; i <= Math.round(r * 0.7); i += 1) {
    inkPixel(image, Math.round(cx - r * 0.4 + i), Math.round(cy + i * 0.45));
    inkPixel(image, Math.round(cx - r * 0.4 + i), Math.round(cy + i * 0.45) + 1);
  }
  for (let i = 0; i <= Math.round(r * 1.2); i += 1) {
    inkPixel(image, Math.round(cx - 1 + i * 0.55), Math.round(cy + r * 0.35 - i * 0.65));
    inkPixel(image, Math.round(cx - 1 + i * 0.55), Math.round(cy + r * 0.35 - i * 0.65) + 1);
  }
}

function nestBusCols(width: number) {
  const pageRight = width * 0.945;
  const bubbleW = width * (58 / 215.9);
  const bubbleX = pageRight - bubbleW;
  const gutter = bubbleW * (9 / 58);
  const colW = (bubbleW - gutter) / 5;
  return [0, 1, 2, 3, 4].map((c) => bubbleX + gutter + colW * c + colW / 2);
}

function nestGroupCols(width: number) {
  const bubbleW = width * (52 / 215.9);
  const bubbleX = width * ((215.9 - 12 - 52) / 215.9);
  const colW = bubbleW / 5;
  return [0, 1, 2, 3, 4].map((c) => bubbleX + colW * c + colW / 2);
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
    expect(weekdayBubbleIndex("2026-11-16")).toBe(0);
    expect(weekdayBubbleIndex("2026-11-17")).toBe(1);
    expect(formatUsAttendanceDate("2026-11-17")).toMatch(/Nov 17/);
    expect(formatUsAttendanceDate("2026-11-17")).toMatch(/Tue/);
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

  it("recognizes Parent Transport from the printed title or header barcode", () => {
    const labels = ["Bus 3", "Parent Transport (PT)", "Bus 7"];
    expect(findPaperSheetLabelsInText("Parent Transport (PT) · Total Passengers: 5", labels, "bus")).toEqual([
      "Parent Transport (PT)",
    ]);
    expect(findPaperSheetLabelsInText("BPARENTTRANSPORTPT", labels, "bus")).toEqual(["Parent Transport (PT)"]);
    expect(encodePaperSheetBarcode("bus", "Parent Transport (PT)")).toBe("BPARENTTRANSPORTPT");
  });

  it("searches a combined PDF for every bus or group title", () => {
    const text = "Bus Roster Report Bus 1 · Bus 12 · Barcelona · Bus 3";
    expect(findPaperSheetLabelsInText(text, ["Bus 1", "Bus 3", "Bus 5", "Bus 12"], "bus").sort()).toEqual([
      "Bus 1",
      "Bus 12",
      "Bus 3",
    ]);
    expect(findPaperSheetLabelsInText(text, ["Barcelona", "Koalas"], "group")).toEqual(["Barcelona"]);
    expect(findPaperSheetLabelsInText("UNASSIGNED (continued)", ["Unassigned", "Barcelona"], "group")).toEqual([
      "Unassigned",
    ]);
    expect(
      unreadPaperSheetReason({
        kind: "group",
        payload: null,
        pageText: "Group Report Unassigned GUNASSIGNED",
        expectedLabels: ["Barcelona", "Koalas"],
      }),
    ).toBe("This page is Unassigned, which is not a group in this season.");
    const pdf = new TextEncoder().encode("%PDF-1.4\nBT (Bus 7) Tj (Bus 9) Tj ET");
    expect(extractPdfLiteralStrings(pdf)).toContain("Bus 7");
    expect(findPaperSheetLabelsInText(extractPdfLiteralStrings(pdf), ["Bus 7", "Bus 8"], "bus")).toEqual(["Bus 7"]);
    expect(findPaperSheetLabelsInText("B u s 1  B u s 1 2", ["Bus 1", "Bus 12"], "bus").sort()).toEqual([
      "Bus 1",
      "Bus 12",
    ]);
  });

  it("does not treat Bus 1 plus 6 campers as Bus 16", () => {
    const text = "Bus Roster Report Bus 1 6 campers 6 AM Bus 12 Total Passengers: 16";
    expect(findPaperSheetLabelsInText(text, ["Bus 1", "Bus 6", "Bus 12", "Bus 16"], "bus").sort()).toEqual([
      "Bus 1",
      "Bus 12",
    ]);
    expect(findPaperSheetLabelsInText("BBUS16", ["Bus 1", "Bus 16"], "bus")).toEqual(["Bus 16"]);
    expect(findPaperSheetLabelsInText("Bus 16 · 8 campers", ["Bus 1", "Bus 16", "Bus 8"], "bus")).toEqual(["Bus 16"]);
  });

  it("lists missing buses after searching one combined roster PDF", () => {
    const expected = Array.from({ length: 39 }, (_, i) => `Bus ${i + 1}`);
    const inPdf = expected.filter((label) => label !== "Bus 17" && label !== "Bus 39");
    const found = findPaperSheetLabelsInText(`Bus Roster Report · ${inPdf.join(" · ")}`, expected, "bus");
    const batch = processPaperAttendancePages([], {
      kind: "bus",
      weekdayIndex: 0,
      expectedLabels: expected,
      rosterForLabel: () => [],
      extraFoundLabels: found,
    });
    expect(batch.scannedLabels).toHaveLength(37);
    expect(batch.missingLabels).toEqual(["Bus 17", "Bus 39"]);
  });

  it("lists missing groups after searching one combined group PDF", () => {
    const expected = ["Barcelona", "Koalas", "Penguins", "Tigers"];
    const found = findPaperSheetLabelsInText("Group List · Barcelona · Penguins · Tigers", expected, "group");
    const batch = processPaperAttendancePages([], {
      kind: "group",
      weekdayIndex: 0,
      expectedLabels: expected,
      rosterForLabel: () => [],
      extraFoundLabels: found,
    });
    expect(batch.scannedLabels.sort()).toEqual(["Barcelona", "Penguins", "Tigers"]);
    expect(batch.missingLabels).toEqual(["Koalas"]);
  });

  it("reads Nest jsPDF bus titles out of one file", () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    doc.text("Bus Roster Report · Bus 1", 12, 18);
    doc.text("BBUS1", 12, 24);
    doc.addPage();
    doc.text("Bus Roster Report · Bus 12", 12, 18);
    const buf = new Uint8Array(doc.output("arraybuffer"));
    const found = findPaperSheetLabelsInText(
      extractPdfLiteralStrings(buf),
      ["Bus 1", "Bus 5", "Bus 12"],
      "bus",
    );
    expect(found.sort()).toEqual(["Bus 1", "Bus 12"]);
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

  it("flips an upside-down group page and reads Tuesday on the printed name", () => {
    const width = 420;
    const height = 520;
    const image = makeWhite(width, height);
    rasterCode39(image, 250, 12, "GUNASSIGNED", { narrow: 1, height: 28 });
    const cols = nestGroupCols(width);
    const names = ["Aayhan Kazmi", "Adam Detore", "Alex Rubel", "Alexandra Simon"];
    const rowsY = [90, 170, 250, 330];
    for (const y of rowsY) {
      for (let c = 0; c < 5; c += 1) {
        if (c === 1 && y === 250) fillCircle(image, cols[c], y, 7, 40);
        else strokeCircle(image, cols[c], y, 7);
      }
    }
    const flipped = flipRgbaVertical(image);
    expect(uprightPaperScanImage(flipped).flipped).toBe(true);
    const longRoster = [
      ...names.map((name, i) => ({ id: String(i), name })),
      ...Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, name: `Camper ${i}` })),
    ];
    const options = {
      kind: "group" as const,
      expectedLabels: ["Unassigned", "Barcelona"],
      rosterForLabel: () => longRoster,
    };
    const tuesday = processPaperAttendancePages(
      [{ image: flipped, sourceName: "group-p1", pageText: "Group Report · Unassigned" }],
      { ...options, weekdayIndex: 1 },
    );
    const monday = processPaperAttendancePages(
      [{ image: flipped, sourceName: "group-p1", pageText: "Group Report · Unassigned" }],
      { ...options, weekdayIndex: 0 },
    );
    expect(tuesday.scannedLabels).toEqual(["Unassigned"]);
    expect(tuesday.sheets[0]?.absents.map((row) => row.camperName)).toEqual(["Alex Rubel"]);
    expect(monday.sheets[0]?.absents).toEqual([]);
  });

  it("keeps a Tuesday group mark on the printed name when the Nest list is in a different order", () => {
    const width = 240;
    const height = 360;
    const image = makeWhite(width, height);
    const cols = nestGroupCols(width);
    const rowsY = [80, 160, 240];
    for (const y of rowsY) {
      for (let c = 0; c < 5; c += 1) {
        if (c === 1 && y === 160) fillCircle(image, cols[c], y, 7, 40);
        else strokeCircle(image, cols[c], y, 7);
      }
    }
    const names = ["Andi Robbins", "Cali Robbins", "Alina Haynes"];
    const result = analyzePaperAttendanceImage(image, {
      kind: "group",
      weekdayIndex: 1,
      camperCount: names.length,
      camperNames: names,
      textItems: [
        { str: "Alina Haynes", x: 20, y: 80 },
        { str: "Andi Robbins", x: 20, y: 160 },
      ],
    });
    expect(omrRowsToAbsentFlags(result.rows, "group").map((row) => row.absent)).toEqual([
      true,
      false,
      false,
    ]);
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

  it("reads the first-page Tuesday fill even when the bus roster is longer than the page", () => {
    const width = 240;
    const height = 360;
    const image = makeWhite(width, height);
    const pageRight = width * 0.945;
    const bubbleW = width * (58 / 215.9);
    const bubbleX = pageRight - bubbleW;
    const gutter = bubbleW * (9 / 58);
    const colW = (bubbleW - gutter) / 5;
    const tops = [70, 150, 230];
    for (const top of tops) {
      for (let c = 0; c < 5; c += 1) {
        const cx = bubbleX + gutter + colW * c + colW / 2;
        if (c === 1 && top === 70) fillCircle(image, cx, top + 12, 6, 40);
        else strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    const names = Array.from({ length: 23 }, (_, i) => (i === 0 ? "Alex Rubel" : `Camper ${i}`));
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 1,
      camperCount: names.length,
      camperNames: names,
    });
    const flags = omrRowsToAbsentFlags(result.rows, "bus");
    expect(flags[0]?.absent).toBe(true);
    expect(flags.slice(1, 3).every((row) => !row.absent)).toBe(true);
  });

  it("reads an X on Aidan when OCR prints Aiden Sardelli", () => {
    const image = makeWhite(240, 360);
    const cols = nestBusCols(240);
    for (const top of [70, 150, 230]) {
      for (const cx of cols) {
        strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    drawX(image, cols[1], 82, 5);
    const names = ["Aidan Sardelli", "Alexandra Simon", "Cade Wallack"];
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 1,
      camperCount: names.length,
      camperNames: names,
      textItems: [
        { str: "Aiden Sardelli", x: 20, y: 82 },
        { str: "Alexandra Simon", x: 20, y: 162 },
        { str: "Cade Wallack", x: 20, y: 242 },
      ],
    });
    expect(omrRowsToAbsentFlags(result.rows, "bus").map((row) => row.absent)).toEqual([true, false, false]);
  });

  it("treats an X or a check in the Tuesday circle as absent", () => {
    const width = 240;
    const height = 360;
    const image = makeWhite(width, height);
    const cols = nestBusCols(width);
    for (const top of [70, 150, 230]) {
      for (const cx of cols) {
        strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    drawX(image, cols[1], 82, 5);
    drawCheck(image, cols[1], 162, 5);
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 1,
      camperCount: 3,
    });
    expect(omrRowsToAbsentFlags(result.rows, "bus").map((row) => row.absent)).toEqual([true, true, false]);
    const monday = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 0,
      camperCount: 3,
    });
    expect(omrRowsToAbsentFlags(monday.rows, "bus").every((row) => !row.absent)).toBe(true);
  });

  it("keeps a Tuesday mark on the printed name when the Nest list is in a different order", () => {
    const image = makeWhite(240, 360);
    const cols = nestBusCols(240);
    for (const top of [70, 150, 230]) {
      for (const cx of cols) {
        strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    fillCircle(image, cols[1], 162, 6, 40);
    const names = ["Andi Robbins", "Cali Robbins", "Alina Haynes"];
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 1,
      camperCount: names.length,
      camperNames: names,
      textItems: [
        { str: "Alina Haynes", x: 20, y: 92 },
        { str: "Andi Robbins", x: 20, y: 172 },
      ],
    });
    expect(omrRowsToAbsentFlags(result.rows, "bus").map((row) => row.absent)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("still marks Alex when his row is read and other names are printed lower", () => {
    const image = makeWhite(240, 360);
    const cols = nestBusCols(240);
    for (const top of [70, 150, 230]) {
      for (const cx of cols) {
        strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    fillCircle(image, cols[1], 82, 6, 40);
    const names = ["Alex Rubel", "Asher Cohan", "Audrey Anteby"];
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 1,
      camperCount: names.length,
      camperNames: names,
      textItems: [
        { str: "Asher Cohan", x: 20, y: 172 },
        { str: "Audrey Anteby", x: 20, y: 252 },
      ],
    });
    expect(omrRowsToAbsentFlags(result.rows, "bus").map((row) => row.absent)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("does not mark empty rings as absent", () => {
    const image = makeWhite(240, 360);
    const pageRight = 240 * 0.945;
    const bubbleW = 240 * (58 / 215.9);
    const bubbleX = pageRight - bubbleW;
    const gutter = bubbleW * (9 / 58);
    const colW = (bubbleW - gutter) / 5;
    for (const top of [70, 150, 230]) {
      for (let c = 0; c < 5; c += 1) {
        const cx = bubbleX + gutter + colW * c + colW / 2;
        strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 0,
      camperCount: 3,
    });
    expect(omrRowsToAbsentFlags(result.rows, "bus").every((row) => !row.absent)).toBe(true);
  });

  it("does not invent absents on an unmarked bus page", () => {
    const image = makeWhite(240, 720);
    const cols = nestBusCols(240);
    for (let r = 0; r < 8; r += 1) {
      const top = 70 + r * 78;
      for (const cx of cols) {
        strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    const names = [
      "Aidan Sardelli",
      "Alexandra Simon",
      "Cade Wallack",
      "Charlotte Simon",
      "Hannah Smolinsky",
      "Harper Barash",
      "Hudson Wein",
      "Isla Valsamopoulos",
    ];
    const result = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 1,
      camperCount: names.length,
      camperNames: names,
    });
    expect(omrRowsToAbsentFlags(result.rows, "bus").every((row) => !row.absent)).toBe(true);
  });

  it("reads a blue Monday AM fill and ignores the Tuesday column", () => {
    const image = makeWhite(240, 360);
    const pageRight = 240 * 0.945;
    const bubbleW = 240 * (58 / 215.9);
    const bubbleX = pageRight - bubbleW;
    const gutter = bubbleW * (9 / 58);
    const colW = (bubbleW - gutter) / 5;
    const blocks = [70, 150, 230];
    for (const top of blocks) {
      for (let c = 0; c < 5; c += 1) {
        const cx = bubbleX + gutter + colW * c + colW / 2;
        strokeCircle(image, cx, top + 12, 6);
        strokeCircle(image, cx, top + 32, 6);
      }
    }
    const monday = bubbleX + gutter + colW * 0 + colW / 2;
    fillCircle(image, monday, 82, 6, 40);
    const mondayRead = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 0,
      camperCount: 3,
      camperNames: ["Arla Zachary", "Gema Escoto", "Gisela Orlowsky"],
    });
    expect(omrRowsToAbsentFlags(mondayRead.rows, "bus").map((row) => row.absent)).toEqual([
      true,
      false,
      false,
    ]);
    const tuesdayRead = analyzePaperAttendanceImage(image, {
      kind: "bus",
      weekdayIndex: 1,
      camperCount: 3,
    });
    expect(tuesdayRead.usedWeekdayIndex).toBe(1);
    expect(tuesdayRead.warning).toMatch(/Tuesday/i);
    expect(tuesdayRead.warning).toMatch(/Monday/i);
    expect(omrRowsToAbsentFlags(tuesdayRead.rows, "bus").map((row) => row.absent)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("uses the same weekly sheet: Monday fill stays Monday, Tuesday fill is Tuesday", () => {
    const image = makeWhite(420, 360);
    rasterCode39(image, 40, 12, "BLV", { narrow: 1, height: 28 });
    const pageRight = 420 * 0.945;
    const bubbleW = 420 * (58 / 215.9);
    const bubbleX = pageRight - bubbleW;
    const gutter = bubbleW * (9 / 58);
    const colW = (bubbleW - gutter) / 5;
    for (let c = 0; c < 5; c += 1) {
      const cx = bubbleX + gutter + colW * c + colW / 2;
      if (c === 0) fillCircle(image, cx, 82, 7, 0);
      else strokeCircle(image, cx, 82, 7);
      strokeCircle(image, cx, 102, 7);
      if (c === 1) fillCircle(image, cx, 162, 7, 0);
      else strokeCircle(image, cx, 162, 7);
      strokeCircle(image, cx, 182, 7);
    }
    const roster = [
      { id: "aria", name: "Aria Zachary" },
      { id: "gema", name: "Gema Escoto" },
    ];
    const options = {
      kind: "bus" as const,
      expectedLabels: ["LV"],
      rosterForLabel: () => roster,
    };
    const monday = processPaperAttendancePages(
      [{ image, sourceName: "lv", pageText: "Bus Roster Report · LV" }],
      { ...options, weekdayIndex: 0 },
    );
    const tuesday = processPaperAttendancePages(
      [{ image, sourceName: "lv", pageText: "Bus Roster Report · LV" }],
      { ...options, weekdayIndex: 1 },
    );
    expect(monday.sheets[0]?.absents.map((row) => row.camperName)).toEqual(["Aria Zachary"]);
    expect(tuesday.sheets[0]?.absents.map((row) => row.camperName)).toEqual(["Gema Escoto"]);
  });

  it("flips an upside-down copier page and reads Tuesday, not Monday", () => {
    const image = makeWhite(420, 360);
    rasterCode39(image, 250, 12, "BBUS3", { narrow: 1, height: 28 });
    const pageRight = 420 * 0.945;
    const bubbleW = 420 * (58 / 215.9);
    const bubbleX = pageRight - bubbleW;
    const gutter = bubbleW * (9 / 58);
    const colW = (bubbleW - gutter) / 5;
    for (let c = 0; c < 5; c += 1) {
      const cx = bubbleX + gutter + colW * c + colW / 2;
      if (c === 1) fillCircle(image, cx, 82, 7, 0);
      else strokeCircle(image, cx, 82, 7);
      strokeCircle(image, cx, 102, 7);
      strokeCircle(image, cx, 162, 7);
      strokeCircle(image, cx, 182, 7);
    }
    const flipped = flipRgbaVertical(image);
    expect(uprightPaperScanImage(flipped).flipped).toBe(true);
    const roster = [
      { id: "alex", name: "Alex Rubel" },
      { id: "asher", name: "Asher Cohan" },
    ];
    const options = {
      kind: "bus" as const,
      expectedLabels: ["Bus 3"],
      rosterForLabel: () => roster,
    };
    const tuesday = processPaperAttendancePages(
      [{ image: flipped, sourceName: "upside-down-bus3" }],
      { ...options, weekdayIndex: 1 },
    );
    const monday = processPaperAttendancePages(
      [{ image: flipped, sourceName: "upside-down-bus3" }],
      { ...options, weekdayIndex: 0 },
    );
    expect(tuesday.scannedLabels).toEqual(["Bus 3"]);
    expect(tuesday.sheets[0]?.absents.map((row) => row.camperName)).toEqual(["Alex Rubel"]);
    expect(monday.sheets[0]?.absents).toEqual([]);
  });

  it("merges absents from a continued bus sheet and skips blank pages", () => {
    const blank = makeWhite(420, 360);
    const batch = processPaperAttendancePages(
      [
        {
          image: (() => {
            const image = makeWhite(420, 360);
            rasterCode39(image, 40, 12, "BLV", { narrow: 1, height: 28 });
            const pageRight = 420 * 0.945;
            const bubbleW = 420 * (58 / 215.9);
            const bubbleX = pageRight - bubbleW;
            const gutter = bubbleW * (9 / 58);
            const colW = (bubbleW - gutter) / 5;
            for (let c = 0; c < 5; c += 1) {
              const cx = bubbleX + gutter + colW * c + colW / 2;
              if (c === 0) fillCircle(image, cx, 82, 7, 0);
              else strokeCircle(image, cx, 82, 7);
              strokeCircle(image, cx, 102, 7);
              strokeCircle(image, cx, 162, 7);
              strokeCircle(image, cx, 182, 7);
            }
            return image;
          })(),
          sourceName: "page-lv",
          pageText: "Bus Roster Report · LV",
        },
        { image: blank, sourceName: "blank" },
      ],
      {
        kind: "bus",
        weekdayIndex: 0,
        expectedLabels: ["LV", "Bus 1"],
        rosterForLabel: (label) =>
          label === "LV"
            ? [
                { id: "arla", name: "Arla Zachary" },
                { id: "gema", name: "Gema Escoto" },
              ]
            : [],
      },
    );
    expect(batch.scannedLabels).toEqual(["LV"]);
    expect(batch.unreadPages).toEqual([]);
    expect(batch.sheets[0]?.absents.map((row) => row.camperName)).toEqual(["Arla Zachary"]);
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
      for (let c = 0; c < 5; c += 1) {
        const cx = bubbleX + gutter + colW * c + colW / 2;
        if (fillFirst && c === 2) fillCircle(image, cx, 82, 7, 0);
        else strokeCircle(image, cx, 82, 7);
        strokeCircle(image, cx, 102, 7);
      }
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
    expect(batch.sheets.find((s) => s.label === "Bus 7")?.absents).toEqual([]);
  });

  it("counts a bus as present from PDF text even with no campers", () => {
    const batch = processPaperAttendancePages(
      [{ sourceName: "rosters.pdf page 1", pageText: "Bus Roster Report · Bus 5" }],
      {
        kind: "bus",
        weekdayIndex: 2,
        expectedLabels: ["Bus 5", "Bus 8"],
        rosterForLabel: () => [],
        extraFoundLabels: ["Bus 5"],
      },
    );
    expect(batch.scannedLabels).toEqual(["Bus 5"]);
    expect(batch.missingLabels).toEqual(["Bus 8"]);
    expect(batch.unreadPages).toEqual([]);
  });

  it("pulls page JPEGs out of a copier PDF", () => {
    const jpeg = new Uint8Array(9000);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    jpeg[3] = 0xe0;
    jpeg[8998] = 0xff;
    jpeg[8999] = 0xd9;
    const pdf = new Uint8Array(20 + jpeg.length);
    pdf.set([0x25, 0x50, 0x44, 0x46], 0);
    pdf.set(jpeg, 10);
    expect(extractJpegBuffersFromPdf(pdf)).toHaveLength(1);
  });

  it("ignores stray FFD8 bytes inside Canon Flate streams", () => {
    const junk = new Uint8Array(9000);
    junk[0] = 0xff;
    junk[1] = 0xd8;
    junk[2] = 0x41;
    junk[8998] = 0xff;
    junk[8999] = 0xd9;
    const pdf = new Uint8Array(40 + junk.length);
    pdf.set(new TextEncoder().encode("%PDF-1.4 /CCITTFaxDecode "), 0);
    pdf.set(junk, 30);
    expect(extractJpegBuffersFromPdf(pdf)).toHaveLength(0);
    expect(pdfUsesMixedRasterContent(pdf)).toBe(true);
  });

  it("inflates Flate+DCT page JPEGs from a copier PDF", async () => {
    const { deflateSync, inflateSync } = await import("node:zlib");
    const jpeg = new Uint8Array(9000);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;
    jpeg[3] = 0xe0;
    jpeg[8998] = 0xff;
    jpeg[8999] = 0xd9;
    const compressed = deflateSync(jpeg);
    const header = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj\n<< /Filter [ /FlateDecode /DCTDecode ] >>\nstream\n",
    );
    const tail = new TextEncoder().encode("\nendstream\n");
    const pdf = new Uint8Array(header.length + compressed.length + tail.length);
    pdf.set(header, 0);
    pdf.set(compressed, header.length);
    pdf.set(tail, header.length + compressed.length);
    const pages = extractFlateDctJpegBuffers(pdf, (data) => inflateSync(data));
    expect(pages).toHaveLength(1);
    expect(pages[0][0]).toBe(0xff);
    expect(pages[0][1]).toBe(0xd8);
  });

  it("extracts eight Flate+DCT pages from Todd's Canon group scan", async () => {
    const { existsSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { inflateSync } = await import("node:zlib");
    const pdfPath = join(process.cwd(), "..", "3963_001.pdf");
    if (!existsSync(pdfPath)) return;
    const buf = new Uint8Array(readFileSync(pdfPath));
    expect(pdfUsesMixedRasterContent(buf)).toBe(true);
    expect(extractJpegBuffersFromPdf(buf)).toHaveLength(0);
    const pages = extractFlateDctJpegBuffers(buf, (data) => inflateSync(data));
    expect(pages).toHaveLength(8);
    expect(pages[0][0]).toBe(0xff);
    expect(pages[0][1]).toBe(0xd8);
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

  it("sends paperless absents to change sheets even if a paper scan is also in use", () => {
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
    expect(rows.find((r) => r.camper === "Jamie Smith")?.source).toBe("Bus attendance");
  });

  it("sends a paper bus-sheet absent to change sheets without a group scan", () => {
    const rows = buildApprovedChangeSheetRows({
      overrideDate: "2026-07-08",
      runPeriod: "am",
      exceptions: [],
      manual: { excluded: {}, added: {} },
      routeMeta,
      coreStops,
      selectedRouteIds: [3],
      paperBusAbsents: [{ camperName: "Jamie Smith" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      camper: "Jamie Smith",
      source: "Paper scan",
      description: "Marked absent on paper bus sheet",
    });
  });
});
