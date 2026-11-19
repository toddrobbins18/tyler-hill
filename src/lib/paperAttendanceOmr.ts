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

function copyRgbaData(image: RgbaImage): Uint8ClampedArray | Uint8Array {
  return image.data instanceof Uint8ClampedArray
    ? new Uint8ClampedArray(image.data.length)
    : new Uint8Array(image.data.length);
}

/** Copier scans often come in flipped; this restores header-at-top. */
export function flipRgbaVertical(image: RgbaImage): RgbaImage {
  const { width, height, data } = image;
  const next = copyRgbaData(image);
  const row = width * 4;
  for (let y = 0; y < height; y += 1) {
    const src = y * row;
    next.set(data.subarray(src, src + row), (height - 1 - y) * row);
  }
  return { width, height, data: next };
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

type BubbleSample = { inner: number; ring: number; ink: number; wideInk: number };

function sampleInkFraction(image: GrayImage, cx: number, cy: number, radius: number): number {
  const r = Math.max(1, radius);
  const r2 = r * r;
  let dark = 0;
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
      count += 1;
      if (image.gray[y * image.width + x] < 205) dark += 1;
    }
  }
  return count ? dark / count : 0;
}

function sampleBubble(image: GrayImage, cx: number, cy: number, radius: number): BubbleSample {
  return {
    inner: sampleDiskMean(image, cx, cy, radius * 0.42),
    ring: sampleAnnulusMean(image, cx, cy, radius * 0.72, radius * 1.18),
    ink: sampleInkFraction(image, cx, cy, radius * 0.42),
    wideInk: sampleInkFraction(image, cx, cy, radius * 0.58),
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
  return (
    looksLikeEmptyCircle(sample, paper)
    || looksLikeFilledCircle(image, cx, cy, radius, sample, paper)
    || sample.ink >= 0.16
  );
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  const i = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[i];
}

function isFilledBubble(sample: BubbleSample, paper: number, emptyInner: number): boolean {
  // Hollow circle with fill, X, check, or scribble is absent.
  if (isHollowCircle(sample, paper)) return sample.ink >= 0.08 || sample.wideInk >= 0.1;
  if (sample.ink >= 0.18) return true;
  if (emptyInner - sample.inner < 24) return false;
  if (sample.inner > 205) return false;
  return paper - sample.inner > 36;
}

function isMarkedVsPeers(
  selected: BubbleSample,
  peers: BubbleSample[],
  paper: number,
  emptyInner: number,
): boolean {
  if (!isFilledBubble(selected, paper, emptyInner)) return false;
  if (peers.length < 2) return true;
  const medInk = percentile(peers.map((s) => s.ink), 0.5);
  const medInner = percentile(peers.map((s) => s.inner), 0.5);
  return selected.ink >= medInk + 0.05 || medInner - selected.inner >= 22;
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
  y0Frac = 0.16,
): { ys: number[]; score: number } {
  const y0 = Math.floor(image.height * y0Frac);
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
  const pageCap = kind === "bus" ? 10 : 14;
  const expected = Math.min(Math.max(camperCount, 1), pageCap) * (kind === "bus" ? 2 : 1);
  const y0Frac = kind === "group" ? 0.1 : 0.16;
  let best: { xs: number[]; radius: number; ys: number[]; rank: number; score: number } | null = null;
  for (const xs of columnSets(image.width, kind)) {
    for (const radius of radii) {
      const found = scoreRows(image, xs, radius, paper, y0Frac);
      const extra = Math.max(0, found.ys.length - expected);
      const rank = found.score / Math.max(1, found.ys.length) - extra * 8;
      if (!best || rank > best.rank) best = { xs, radius, ys: found.ys, rank, score: found.score };
    }
  }
  const picked = best ?? {
    xs: columnSets(image.width, kind)[0],
    radius: Math.max(4, Math.round(image.width * 0.02)),
    ys: [] as number[],
    rank: 0,
    score: 0,
  };
  if (image.width >= 800) {
    const printed = Math.max(4, Math.round(image.width * (2 / PAGE_W_MM)));
    const nest = columnSets(image.width, kind)[0];
    const found = scoreRows(image, nest, printed, paper, y0Frac);
    if (found.ys.length >= 4) {
      picked.xs = nest;
      picked.ys = found.ys;
      picked.radius = printed;
      picked.rank = found.score;
      picked.score = found.score;
    }
  }
  return picked;
}

function dropHeaderArtifact<T extends { y: number }>(rows: T[]): T[] {
  let next = rows;
  for (let pass = 0; pass < 2 && next.length >= 4; pass += 1) {
    const gaps = next.slice(1).map((row, i) => row.y - next[i].y);
    const sorted = [...gaps].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
    if (!(med > 0 && gaps[0] < med * 0.85)) break;
    next = next.slice(1);
  }
  return next;
}

function pairBusRows(ys: number[], radius: number): Array<{ y: number; amY: number; pmY: number }> {
  const pairMax = radius * 5.2;
  const pairMin = radius * 1.7;
  const canPair = (a: number, b: number | undefined) => b != null && b - a >= pairMin && b - a <= pairMax;
  const build = (start: number) => {
    const rows: Array<{ y: number; amY: number; pmY: number }> = [];
    let pairs = 0;
    const gaps: number[] = [];
    let i = start;
    while (i < ys.length) {
      const a = ys[i];
      const b = ys[i + 1];
      if (canPair(a, b)) {
        rows.push({ y: (a + b) / 2, amY: a, pmY: b });
        gaps.push(b - a);
        pairs += 1;
        i += 2;
      } else {
        rows.push({ y: a, amY: a, pmY: a + radius * 2.8 });
        i += 1;
      }
    }
    const mean = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : pairMax;
    const variance = gaps.length
      ? gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / gaps.length
      : pairMax * pairMax;
    return { rows, pairs, variance };
  };
  const first = build(0);
  const second = ys.length > 2 ? build(1) : first;
  if (second.pairs > first.pairs) return second.rows;
  if (second.pairs === first.pairs && second.variance < first.variance) return second.rows;
  return first.rows;
}

function firstNamesClose(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return a.length >= 3 && b.length >= 3;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diffs += 1;
    return diffs === 1;
  }
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let i = 0;
  let j = 0;
  let skip = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
      continue;
    }
    skip += 1;
    i += 1;
    if (skip > 1) return false;
  }
  return true;
}

function nameYs(
  names: string[],
  items: PaperTextItem[],
  width: number,
): Array<number | null> {
  const left = items.filter((item) => item.x < width * 0.58 && item.str.trim());
  const lastCounts = new Map<string, number>();
  for (const name of names) {
    const last = normName(name).split(" ").at(-1) ?? "";
    if (last.length >= 4) lastCounts.set(last, (lastCounts.get(last) ?? 0) + 1);
  }
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
      const printed = s.split(" ");
      const printedFirst = printed[0] ?? "";
      const printedLast = printed[printed.length - 1] ?? "";
      let score = 0;
      if (s.includes(n) || (n.includes(s) && s.length >= 8)) score = 4;
      else if (last.length >= 3 && first.length >= 2 && s.includes(last) && s.includes(first)) score = 3;
      else if (last.length >= 4 && s.includes(last) && firstNamesClose(first, printedFirst)) score = 3;
      else if (last.length >= 4 && printedLast === last && (lastCounts.get(last) ?? 0) === 1) score = 3;
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
    ? pairBusRows(geometry.ys, radius)
    : geometry.ys.map((y) => ({ y, amY: y, pmY: y }));
  rowYs = rowYs.filter((row) => row.y >= gray.height * (options.kind === "group" ? 0.1 : 0.16));
  rowYs = dropHeaderArtifact(rowYs);
  if (options.kind === "group" && rowYs.length >= 4) {
    const firstGap = rowYs[1].y - rowYs[0].y;
    const secondGap = rowYs[2].y - rowYs[1].y;
    if (secondGap > 0 && firstGap < secondGap * 0.6) rowYs = rowYs.slice(1);
  }
  const pageCap = options.kind === "bus" ? 10 : 14;
  if (rowYs.length > pageCap) rowYs = rowYs.slice(0, pageCap);

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
  const daySamplesAt = (y: number): BubbleSample[] => [0, 1, 2, 3, 4].map((col) => sampleAt(col, y));
  const columnPitch = Math.abs((xs[1] ?? xs[0] + 20) - xs[0]);
  const xReach = Math.max(2, Math.round(columnPitch * 0.22));
  const bandSample = (col: number, y0: number, y1: number): BubbleSample => {
    const center = xs[col] ?? xs[0];
    let best = sampleBubble(gray, center, y0, radius);
    const step = Math.max(2, Math.round(radius * 0.5));
    const xsToTry = [center];
    for (let dx = 2; dx <= xReach; dx += 2) xsToTry.push(center - dx, center + dx);
    for (let y = y0; y <= y1; y += step) {
      for (const x of xsToTry) {
        const sample = sampleBubble(gray, x, y, radius);
        if (sample.ink > best.ink || (sample.ink === best.ink && sample.inner < best.inner)) best = sample;
      }
    }
    return best;
  };
  const rowSpan = (row: { y: number; amY: number; pmY: number }) => {
    const top = Math.min(row.amY, row.pmY, row.y);
    const bottom = Math.max(row.amY, row.pmY, row.y);
    const pad = Math.max(radius * 1.5, 4);
    return { y0: top - pad, y1: bottom + pad };
  };
  while (rowYs.length >= 2 && rowYs[0].y < gray.height * 0.18) {
    const days = daySamplesAt(rowYs[0].amY);
    if (countFilled(days, paper, emptyInnerFor(days, paper)) < 3) break;
    rowYs = rowYs.slice(1);
  }

  const names = options.camperNames ?? [];
  const items = (options.textItems ?? []).map((item) => ({
    str: item.str,
    x: item.x * scaleX,
    y: item.y * scaleY,
  }));
  const fromNames = names.length ? nameYs(names, items, gray.width) : [];
  type AlignedRow = { y: number; amY: number; pmY: number };
  const rowTargetY = (row: AlignedRow) => (options.kind === "bus" ? (row.amY + row.y) / 2 : row.y);
  const rowHasSelectedMark = (row: AlignedRow) => {
    const span = rowSpan(row);
    const bubbles = [0, 1, 2, 3, 4].map((col) => bandSample(col, span.y0, span.y1));
    const empty = emptyInnerFor(bubbles, paper);
    return isMarkedVsPeers(
      bubbles[weekdayIndex],
      bubbles.filter((_, col) => col !== weekdayIndex),
      paper,
      empty,
    );
  };
  let aligned: Array<AlignedRow | null> = names.length ? names.map(() => null) : [...rowYs];
  const namedCount = fromNames.filter((y) => y != null).length;
  if (names.length && namedCount >= 1) {
    const band = Math.max(radius * 9, gray.height * 0.075);
    const usedRows = new Set<number>();
    const pairs: Array<{ nameI: number; rowI: number; dist: number }> = [];
    fromNames.forEach((ny, nameI) => {
      if (ny == null) return;
      rowYs.forEach((row, rowI) => {
        const dist = Math.abs(rowTargetY(row) - ny);
        if (dist <= band) pairs.push({ nameI, rowI, dist });
      });
    });
    pairs.sort((a, b) => a.dist - b.dist);
    for (const { nameI, rowI } of pairs) {
      if (aligned[nameI] != null || usedRows.has(rowI)) continue;
      aligned[nameI] = rowYs[rowI];
      usedRows.add(rowI);
    }
    rowYs.forEach((row, rowI) => {
      if (usedRows.has(rowI) || !rowHasSelectedMark(row)) return;
      let bestI = -1;
      let bestD = gray.height * 0.09;
      fromNames.forEach((ny, nameI) => {
        if (ny == null || aligned[nameI] != null) return;
        const dist = Math.abs(rowTargetY(row) - ny);
        if (dist < bestD) {
          bestD = dist;
          bestI = nameI;
        }
      });
      if (bestI >= 0) {
        aligned[bestI] = row;
        usedRows.add(rowI);
        return;
      }
      if (rowI < names.length && aligned[rowI] == null && fromNames[rowI] == null) {
        aligned[rowI] = row;
        usedRows.add(rowI);
      }
    });
  } else if (names.length) {
    aligned = names.map((_, i) => rowYs[i] ?? null);
  }
  rowYs.forEach((row) => {
    if (!rowHasSelectedMark(row) || aligned.some((item) => item === row)) return;
    let bestI = -1;
    let bestD = Number.POSITIVE_INFINITY;
    fromNames.forEach((ny, nameI) => {
      if (ny == null) return;
      const current = aligned[nameI];
      if (current && rowHasSelectedMark(current)) return;
      const dist = Math.abs(rowTargetY(row) - ny);
      if (dist < bestD) {
        bestD = dist;
        bestI = nameI;
      }
    });
    if (bestI >= 0) {
      aligned[bestI] = row;
      return;
    }
    const rowI = rowYs.indexOf(row);
    if (rowI >= 0 && rowI < names.length) {
      const current = aligned[rowI];
      if (!current || !rowHasSelectedMark(current)) aligned[rowI] = row;
    }
  });

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

  const useCount = aligned.filter((row) => row).length;

  const weekdaySamples = (col: number): BubbleSample[] => {
    const out: BubbleSample[] = [];
    for (const row of aligned) {
      if (!row) continue;
      if (options.kind === "bus") {
        out.push(sampleAt(col, row.amY), sampleAt(col, row.pmY));
      } else {
        const span = rowSpan(row);
        out.push(bandSample(col, span.y0, span.y1));
      }
    }
    return out;
  };

  const samplesByDay = [0, 1, 2, 3, 4].map((col) => weekdaySamples(col));
  const emptyByDay = samplesByDay.map((samples) => emptyInnerFor(samples, paper));
  const emptyInner = emptyByDay[weekdayIndex] ?? paper;
  const rows: PaperOmrRow[] = [];
  const filledByDay = [0, 0, 0, 0, 0];
  for (let i = 0; i < camperCount; i += 1) {
    const sample = aligned[i];
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
      const span = rowSpan(sample);
      const bubbles = [0, 1, 2, 3, 4].map((col) => bandSample(col, span.y0, span.y1));
      const marked = bubbles.map((bubble, col) =>
        isMarkedVsPeers(
          bubble,
          bubbles.filter((_, other) => other !== col),
          paper,
          emptyByDay[col] ?? emptyInner,
        ),
      );
      marked.forEach((on, col) => {
        if (on) filledByDay[col] += 1;
      });
      rows.push({
        camperIndex: i,
        y: sample.y,
        dailyFilled: marked[weekdayIndex],
        confidence: 0.86,
      });
    } else {
      const span = rowSpan(sample);
      const bubbles = [0, 1, 2, 3, 4].map((col) => bandSample(col, span.y0, span.y1));
      const marked = bubbles.map((bubble, col) =>
        isMarkedVsPeers(
          bubble,
          bubbles.filter((_, other) => other !== col),
          paper,
          emptyByDay[col] ?? emptyInner,
        ),
      );
      [0, 1, 2, 3, 4].forEach((col) => {
        if (marked[col]) filledByDay[col] += 1;
      });
      rows.push({
        camperIndex: i,
        y: sample.y,
        amFilled: marked[weekdayIndex],
        pmFilled: false,
        confidence: 0.86,
      });
    }
  }

  const selectedFilled = filledByDay[weekdayIndex] ?? 0;
  const otherFilled = filledByDay
    .map((count, col) => ({ col, count }))
    .filter((row) => row.col !== weekdayIndex && row.count > 0);
  let warning: string | undefined;
  if (selectedFilled === 0 && otherFilled.length > 0) {
    const otherDays = otherFilled.map((row) => WEEKDAY_NAMES[row.col]).join(", ");
    warning = `No ${WEEKDAY_NAMES[weekdayIndex]} marks. Filled bubbles are on ${otherDays}.`;
  }

  if (useCount < 2 && camperCount >= 2 && !warning) {
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
