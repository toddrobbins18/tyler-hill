export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

export type PaperTextItem = {
  str: string;
  x: number;
  y: number;
};

export type PaperOmrRow = {
  camperIndex: number;
  y: number;
  dailyFilled?: boolean;
  amFilled?: boolean;
  pmFilled?: boolean;
  confidence: number;
};

export type PaperOmrResult = {
  rows: PaperOmrRow[];
  expectedRows: number;
  detectedRows: number;
  warning?: string;
  usedWeekdayIndex?: number;
};

type GrayImage = { width: number; height: number; gray: Uint8Array };

const PAGE_W_MM = 215.9;
const PAGE_H_MM = 279.4;
const MARGIN_MM = 12;
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function rgbaToGray(image: RgbaImage): GrayImage {
  const gray = new Uint8Array(image.width * image.height);
  const src = image.data;
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (src[p] * 77 + src[p + 1] * 150 + src[p + 2] * 29) >> 8;
  }
  return { width: image.width, height: image.height, gray };
}

function downsampleGray(src: GrayImage, maxSide: number): GrayImage {
  const long = Math.max(src.width, src.height);
  if (long <= maxSide) return src;
  const scale = maxSide / long;
  const width = Math.max(1, Math.round(src.width * scale));
  const height = Math.max(1, Math.round(src.height * scale));
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      gray[y * width + x] = src.gray[sy * src.width + sx];
    }
  }
  return { width, height, gray };
}

function sampleDiskMean(image: GrayImage, cx: number, cy: number, radius: number): number {
  const r = Math.max(1, radius);
  const r2 = r * r;
  let sum = 0;
  let count = 0;
  const x0 = clamp(Math.floor(cx - r), 0, image.width - 1);
  const x1 = clamp(Math.ceil(cx + r), 0, image.width - 1);
  const y0 = clamp(Math.floor(cy - r), 0, image.height - 1);
  const y1 = clamp(Math.ceil(cy + r), 0, image.height - 1);
  for (let y = y0; y <= y1; y += 1) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      if (dx * dx + dy * dy > r2) continue;
      sum += image.gray[y * image.width + x];
      count += 1;
    }
  }
  return count ? sum / count : 255;
}

function sampleAnnulusMean(image: GrayImage, cx: number, cy: number, r0: number, r1: number): number {
  const inner = Math.max(0.5, r0);
  const outer = Math.max(inner + 0.75, r1);
  const inner2 = inner * inner;
  const outer2 = outer * outer;
  let sum = 0;
  let count = 0;
  const x0 = clamp(Math.floor(cx - outer), 0, image.width - 1);
  const x1 = clamp(Math.ceil(cx + outer), 0, image.width - 1);
  const y0 = clamp(Math.floor(cy - outer), 0, image.height - 1);
  const y1 = clamp(Math.ceil(cy + outer), 0, image.height - 1);
  for (let y = y0; y <= y1; y += 1) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x += 1) {
      const d2 = (x - cx) * (x - cx) + dy * dy;
      if (d2 < inner2 || d2 > outer2) continue;
      sum += image.gray[y * image.width + x];
      count += 1;
    }
  }
  return count ? sum / count : 255;
}

export function isMostlyBlankImage(image: RgbaImage): boolean {
  const gray = downsampleGray(rgbaToGray(image), 700);
  let dark = 0;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < gray.gray.length; i += 5) {
    n += 1;
    sum += gray.gray[i];
    if (gray.gray[i] < 210) dark += 1;
  }
  return n > 0 && sum / n > 247 && dark / n < 0.01;
}

function paperMean(image: GrayImage): number {
  const xs = [Math.floor(image.width * 0.04), Math.floor(image.width * 0.08)];
  const ys = [Math.floor(image.height * 0.06), Math.floor(image.height * 0.5), Math.floor(image.height * 0.9)];
  let sum = 0;
  let count = 0;
  for (const y of ys) {
    for (const x of xs) {
      sum += sampleDiskMean(image, x, y, 4);
      count += 1;
    }
  }
  return count ? sum / count : 245;
}

function nestCenters(width: number, bubbleWmm: number, gutterMm: number): number[] {
  const bubbleX = width * ((PAGE_W_MM - MARGIN_MM - bubbleWmm) / PAGE_W_MM);
  const bubbleW = width * (bubbleWmm / PAGE_W_MM);
  const gutter = width * (gutterMm / PAGE_W_MM);
  const colW = (bubbleW - gutter) / 5;
  return [0, 1, 2, 3, 4].map((i) => bubbleX + gutter + colW * i + colW / 2);
}

function legacyGroupCenters(width: number): number[] {
  const x0 = width * 0.62;
  const colW = (width * 0.38) / 5;
  return [0, 1, 2, 3, 4].map((i) => x0 + colW * i + colW / 2);
}

function columnSets(width: number, kind: "bus" | "group"): number[][] {
  if (kind === "bus") return [nestCenters(width, 58, 9)];
  return [nestCenters(width, 52, 0), legacyGroupCenters(width)];
}

type BubbleSample = { inner: number; ring: number };

function sampleBubble(image: GrayImage, cx: number, cy: number, radius: number): BubbleSample {
  return {
    inner: sampleDiskMean(image, cx, cy, radius * 0.42),
    ring: sampleAnnulusMean(image, cx, cy, radius * 0.72, radius * 1.18),
  };
}

function isHollowCircle(sample: BubbleSample, paper: number): boolean {
  return sample.inner - sample.ring > 18 && sample.inner > paper - 55;
}

function looksLikeEmptyCircle(sample: BubbleSample, paper: number): boolean {
  return isHollowCircle(sample, paper) && paper - sample.ring > 18;
}

function looksLikeFilledCircle(
  image: GrayImage,
  cx: number,
  cy: number,
  radius: number,
  sample: BubbleSample,
  paper: number,
): boolean {
  if (sample.inner > 130) return false;
  if (paper - sample.inner < 70) return false;
  const outside = sampleAnnulusMean(image, cx, cy, radius * 1.35, radius * 2.1);
  return outside > paper - 45 && outside - sample.inner > 55;
}

function looksLikeCircle(
  image: GrayImage,
  cx: number,
  cy: number,
  radius: number,
  sample: BubbleSample,
  paper: number,
): boolean {
  return looksLikeEmptyCircle(sample, paper) || looksLikeFilledCircle(image, cx, cy, radius, sample, paper);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  const i = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[i];
}

function isFilledBubble(sample: BubbleSample, paper: number, emptyInner: number): boolean {
  if (isHollowCircle(sample, paper)) return false;
  if (emptyInner - sample.inner < 50) return false;
  if (sample.inner > 160) return false;
  return paper - sample.inner > 60;
}

function nonMaxima(scores: Float32Array, y0: number, y1: number, minSep: number): number[] {
  const peaks: number[] = [];
  const sep = Math.max(3, Math.round(minSep));
  for (let y = y0; y <= y1; y += 1) {
    const score = scores[y] ?? 0;
    if (score <= 0) continue;
    let best = true;
    for (let d = 1; d <= sep; d += 1) {
      if ((scores[y - d] ?? 0) > score || (scores[y + d] ?? 0) > score) {
        best = false;
        break;
      }
    }
    if (best) peaks.push(y);
  }
  return peaks;
}

function scoreRows(
  image: GrayImage,
  xs: number[],
  radius: number,
  paper: number,
): { ys: number[]; score: number } {
  const y0 = Math.floor(image.height * 0.22);
  const y1 = Math.floor(image.height * 0.97);
  const scores = new Float32Array(image.height);
  const xShift = Math.max(2, Math.round(radius * 0.8));
  for (let y = y0; y <= y1; y += 1) {
    let votes = 0;
    let contrast = 0;
    for (const baseX of xs) {
      let best: BubbleSample | null = null;
      let bestX = baseX;
      for (const x of [baseX - xShift, baseX, baseX + xShift]) {
        const sample = sampleBubble(image, x, y, radius);
        if (!best || paper - sample.ring > paper - best.ring) {
          best = sample;
          bestX = x;
        }
      }
      if (best && looksLikeCircle(image, bestX, y, radius, best, paper)) {
        votes += 1;
        contrast += paper - best.ring;
      }
    }
    scores[y] = votes >= 1 ? contrast + votes * 8 : 0;
  }
  const ys = nonMaxima(scores, y0, y1, radius * 1.55);
  const score = ys.reduce((sum, y) => sum + (scores[y] ?? 0), 0);
  return { ys, score };
}

function pickRadiusAndColumns(
  image: GrayImage,
  kind: "bus" | "group",
  camperCount: number,
  paper: number,
): { xs: number[]; radius: number; ys: number[] } {
  const radii = [...new Set([
    Math.max(3, Math.round(image.width * (2 / PAGE_W_MM))),
    Math.max(3, Math.round(image.width * 0.016)),
    Math.max(4, Math.round(image.width * 0.025)),
    Math.max(5, Math.round(image.width * 0.032)),
    6,
    7,
  ])].filter((r) => r >= 3 && r <= image.width * 0.06);
  const expected = kind === "bus" ? camperCount * 2 : camperCount;
  let best: { xs: number[]; radius: number; ys: number[]; rank: number } | null = null;
  for (const xs of columnSets(image.width, kind)) {
    for (const radius of radii) {
      const found = scoreRows(image, xs, radius, paper);
      const err = Math.abs(found.ys.length - expected);
      const rank = found.score / Math.max(1, err + 1) - err * 40;
      if (!best || rank > best.rank) best = { xs, radius, ys: found.ys, rank };
    }
  }
  return best ?? { xs: columnSets(image.width, kind)[0], radius: Math.max(4, Math.round(image.width * 0.02)), ys: [] };
}

function dropHeaderArtifact<T extends { y: number }>(rows: T[]): T[] {
  if (rows.length < 3) return rows;
  const gaps = rows.slice(1).map((row, i) => row.y - rows[i].y);
  const sorted = [...gaps].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (med > 0 && gaps[0] < med * 0.72) return rows.slice(1);
  return rows;
}

function pairBusRows(ys: number[], radius: number): Array<{ y: number; amY: number; pmY: number }> {
  const pairMax = radius * 5.2;
  const pairMin = radius * 1.7;
  const rows: Array<{ y: number; amY: number; pmY: number }> = [];
  let i = 0;
  while (i < ys.length) {
    const a = ys[i];
    const b = ys[i + 1];
    if (b != null && b - a >= pairMin && b - a <= pairMax) {
      rows.push({ y: (a + b) / 2, amY: a, pmY: b });
      i += 2;
    } else {
      rows.push({ y: a, amY: a, pmY: a + radius * 2.8 });
      i += 1;
    }
  }
  return rows;
}

function nameYs(
  names: string[],
  items: PaperTextItem[],
  width: number,
): Array<number | null> {
  const left = items.filter((item) => item.x < width * 0.58 && item.str.trim());
  return names.map((name) => {
    const n = normName(name);
    if (!n) return null;
    const parts = n.split(" ");
    const first = parts[0] ?? "";
    const last = parts[parts.length - 1] ?? "";
    let bestY: number | null = null;
    let best = 0;
    for (const item of left) {
      const s = normName(item.str);
      if (!s) continue;
      let score = 0;
      if (s.includes(n) || (n.includes(s) && s.length >= 8)) score = 4;
      else if (last.length >= 3 && first.length >= 2 && s.includes(last) && s.includes(first)) score = 3;
      else if (last.length >= 4 && s.includes(last)) score = 1;
      if (score > best) {
        best = score;
        bestY = item.y;
      }
    }
    return best >= 3 ? bestY : null;
  });
}

function emptyInnerFor(samples: BubbleSample[], paper: number): number {
  const inners = samples.map((s) => s.inner);
  if (!inners.length) return paper;
  return Math.max(paper - 8, percentile(inners, 0.75));
}

function countFilled(samples: BubbleSample[], paper: number, emptyInner: number): number {
  return samples.filter((s) => isFilledBubble(s, paper, emptyInner)).length;
}

export function analyzePaperAttendanceImage(
  image: RgbaImage,
  options: {
    kind: "bus" | "group";
    weekdayIndex: number;
    camperCount: number;
    camperNames?: string[];
    textItems?: PaperTextItem[];
  },
): PaperOmrResult {
  const camperCount = Math.max(0, Math.floor(options.camperCount));
  const weekdayIndex = clamp(Math.round(options.weekdayIndex), 0, 4);
  if (camperCount <= 0) {
    return { rows: [], expectedRows: 0, detectedRows: 0, warning: "No campers on this sheet." };
  }

  const gray = downsampleGray(rgbaToGray(image), 1400);
  const scaleX = gray.width / image.width;
  const scaleY = gray.height / image.height;
  const paper = paperMean(gray);
  const geometry = pickRadiusAndColumns(gray, options.kind, camperCount, paper);
  const { xs, radius } = geometry;
  let rowYs = options.kind === "bus"
    ? dropHeaderArtifact(pairBusRows(geometry.ys, radius))
    : dropHeaderArtifact(geometry.ys.map((y) => ({ y, amY: y, pmY: y })));

  const names = options.camperNames ?? [];
  const items = (options.textItems ?? []).map((item) => ({
    str: item.str,
    x: item.x * scaleX,
    y: item.y * scaleY,
  }));
  const fromNames = names.length ? nameYs(names, items, gray.width) : [];
  const namedCount = fromNames.filter((y) => y != null).length;
  if (namedCount >= Math.max(1, Math.round(camperCount * 0.6))) {
    const pmShift = gray.height * (6 / PAGE_H_MM);
    rowYs = fromNames.map((y, i) => {
      const fallback = rowYs[i]?.y ?? (y ?? 0);
      const cy = y ?? fallback;
      return {
        y: cy,
        amY: cy,
        pmY: options.kind === "bus" ? cy + pmShift : cy,
      };
    });
  }

  if (!rowYs.length) {
    return {
      rows: Array.from({ length: camperCount }, (_, i) => ({
        camperIndex: i,
        y: 0,
        dailyFilled: false,
        amFilled: false,
        pmFilled: false,
        confidence: 0,
      })),
      expectedRows: camperCount,
      detectedRows: 0,
      usedWeekdayIndex: weekdayIndex,
      warning: "Could not read bubbles on this sheet. Mark absents by hand.",
    };
  }

  const useCount = Math.min(camperCount, rowYs.length);
  const rowsToRead = rowYs.slice(0, useCount);
  const xShift = Math.max(2, Math.round(radius * 0.8));

  const sampleAt = (col: number, y: number): BubbleSample => {
    const baseX = xs[col] ?? xs[0];
    let best = sampleBubble(gray, baseX, y, radius);
    for (const x of [baseX - xShift, baseX + xShift]) {
      const sample = sampleBubble(gray, x, y, radius);
      if (paper - sample.ring > paper - best.ring) best = sample;
    }
    return best;
  };

  const weekdaySamples = (col: number): BubbleSample[] => {
    const out: BubbleSample[] = [];
    for (const row of rowsToRead) {
      if (options.kind === "bus") {
        out.push(sampleAt(col, row.amY), sampleAt(col, row.pmY));
      } else {
        out.push(sampleAt(col, row.y));
      }
    }
    return out;
  };

  const samplesByDay = [0, 1, 2, 3, 4].map((col) => weekdaySamples(col));
  const emptyByDay = samplesByDay.map((samples) => emptyInnerFor(samples, paper));
  const filledByDay = samplesByDay.map((samples, col) => countFilled(samples, paper, emptyByDay[col]));
  const selectedFilled = filledByDay[weekdayIndex] ?? 0;
  const otherFilled = filledByDay
    .map((count, col) => ({ col, count }))
    .filter((row) => row.col !== weekdayIndex && row.count > 0);
  let warning: string | undefined;
  if (selectedFilled === 0 && otherFilled.length > 0) {
    const otherDays = otherFilled.map((row) => WEEKDAY_NAMES[row.col]).join(", ");
    warning = `No ${WEEKDAY_NAMES[weekdayIndex]} marks. Filled bubbles are on ${otherDays}.`;
  }

  const emptyInner = emptyByDay[weekdayIndex] ?? paper;
  const rows: PaperOmrRow[] = [];
  for (let i = 0; i < camperCount; i += 1) {
    const sample = rowsToRead[i];
    if (!sample) {
      rows.push({
        camperIndex: i,
        y: 0,
        dailyFilled: false,
        amFilled: false,
        pmFilled: false,
        confidence: 0.2,
      });
      continue;
    }
    if (options.kind === "group") {
      const bubble = sampleAt(weekdayIndex, sample.y);
      rows.push({
        camperIndex: i,
        y: sample.y,
        dailyFilled: isFilledBubble(bubble, paper, emptyInner),
        confidence: 0.86,
      });
    } else {
      const am = sampleAt(weekdayIndex, sample.amY);
      const pm = sampleAt(weekdayIndex, sample.pmY);
      rows.push({
        camperIndex: i,
        y: sample.y,
        amFilled: isFilledBubble(am, paper, emptyInner),
        pmFilled: isFilledBubble(pm, paper, emptyInner),
        confidence: 0.86,
      });
    }
  }

  if (useCount < camperCount && !warning) {
    warning = "Could not line up every row. Check the marked names.";
  }

  return {
    rows,
    expectedRows: camperCount,
    detectedRows: useCount,
    usedWeekdayIndex: weekdayIndex,
    warning,
  };
}

export function omrRowsToAbsentFlags(
  rows: PaperOmrRow[],
  kind: "bus" | "group",
): Array<{ camperIndex: number; absent: boolean }> {
  return rows.map((row) => ({
    camperIndex: row.camperIndex,
    absent: kind === "bus" ? !!(row.amFilled || row.pmFilled) : !!row.dailyFilled,
  }));
}
