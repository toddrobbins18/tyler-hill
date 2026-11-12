export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
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
};

type GrayImage = { width: number; height: number; gray: Uint8Array };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
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

function isFilled(innerMean: number): boolean {
  return innerMean < 132;
}

type Blob = { x: number; y: number; w: number; h: number; area: number };

function findDarkBlobs(image: GrayImage, x0: number, y0: number, x1: number, y1: number): Blob[] {
  const w = image.width;
  const h = image.height;
  const visited = new Uint8Array(w * h);
  const blobs: Blob[] = [];
  const stack: number[] = [];

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * w + x;
      if (visited[i] || image.gray[i] > 110) continue;
      stack.length = 0;
      stack.push(i);
      visited[i] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let area = 0;
      let sx = 0;
      let sy = 0;
      while (stack.length) {
        const idx = stack.pop()!;
        const px = idx % w;
        const py = (idx - px) / w;
        area += 1;
        sx += px;
        sy += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        const neighbors = [idx - 1, idx + 1, idx - w, idx + w];
        for (const n of neighbors) {
          if (n < 0 || n >= visited.length || visited[n]) continue;
          const nx = n % w;
          const ny = (n - nx) / w;
          if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
          if (image.gray[n] > 110) continue;
          visited[n] = 1;
          stack.push(n);
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const aspect = bw / Math.max(1, bh);
      if (area < 8 || area > (w * h) / 15) continue;
      if (bh < 3 || bw < 3) continue;
      if (aspect < 0.3 || aspect > 12) continue;
      blobs.push({
        x: sx / area,
        y: sy / area,
        w: bw,
        h: bh,
        area,
      });
    }
  }
  return blobs;
}

function clusterYs(values: number[], tol: number): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = groups[groups.length - 1];
    if (sorted[i] - last[last.length - 1] <= tol) last.push(sorted[i]);
    else groups.push([sorted[i]]);
  }
  return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
}

type CamperSampleY = { y: number; amY: number; pmY: number };

function padYs(ys: number[], expected: number, stepFallback: number): number[] {
  const out = ys.slice(0, expected);
  while (out.length < expected) {
    const step = out.length > 1 ? out[out.length - 1] - out[out.length - 2] : stepFallback;
    out.push((out[out.length - 1] ?? 0) + step);
  }
  return out;
}

function evenYs(camperCount: number, roiTop: number, roiBottom: number): number[] {
  const span = roiBottom - roiTop;
  const ys: number[] = [];
  for (let i = 0; i < camperCount; i += 1) {
    ys.push(roiTop + span * ((i + 0.5) / camperCount));
  }
  return ys;
}

function camperSampleRows(
  kind: "bus" | "group",
  camperCount: number,
  blobs: Blob[],
  roiTop: number,
  roiBottom: number,
): { rows: CamperSampleY[]; usedBlobs: boolean } {
  const span = roiBottom - roiTop;
  const step = span / Math.max(1, camperCount);
  const medianH = blobs.length
    ? [...blobs].sort((a, b) => a.h - b.h)[Math.floor(blobs.length / 2)].h
    : Math.max(8, step * 0.2);
  const tight = clusterYs(
    blobs.map((b) => b.y),
    Math.max(4, medianH * 0.7),
  );

  if (kind === "bus" && tight.length >= camperCount * 1.5) {
    const rows: CamperSampleY[] = [];
    for (let i = 0; i < camperCount; i += 1) {
      const amY = tight[i * 2];
      const pmY = tight[i * 2 + 1] ?? (amY == null ? 0 : amY + step * 0.25);
      if (amY == null) break;
      rows.push({ y: (amY + pmY) / 2, amY, pmY });
    }
    if (rows.length >= Math.max(1, Math.round(camperCount * 0.7))) {
      while (rows.length < camperCount) {
        const prev = rows[rows.length - 1];
        rows.push({
          y: prev.y + step,
          amY: prev.amY + step,
          pmY: prev.pmY + step,
        });
      }
      return { rows, usedBlobs: true };
    }
  }

  const clusteredEnough = tight.length >= Math.max(1, Math.round(camperCount * 0.7));
  const ys = clusteredEnough ? padYs(tight, camperCount, step) : evenYs(camperCount, roiTop, roiBottom);
  const split = step * 0.12;
  return {
    rows: ys.map((y) => ({
      y,
      amY: kind === "bus" ? y - split : y,
      pmY: kind === "bus" ? y + split : y,
    })),
    usedBlobs: clusteredEnough,
  };
}

function bubbleSampleX(width: number, kind: "bus" | "group", weekdayIndex: number): number {
  if (kind === "group") {
    const x0 = width * 0.62;
    const colW = (width - x0) / 5;
    return x0 + colW * weekdayIndex + colW / 2;
  }
  const pageRight = width * 0.945;
  const bubbleW = width * (58 / 215.9);
  const bubbleX = pageRight - bubbleW;
  const gutter = bubbleW * (9 / 58);
  const colW = (bubbleW - gutter) / 5;
  return bubbleX + gutter + colW * weekdayIndex + colW / 2;
}

export function analyzePaperAttendanceImage(
  image: RgbaImage,
  options: {
    kind: "bus" | "group";
    weekdayIndex: number;
    camperCount: number;
  },
): PaperOmrResult {
  const camperCount = Math.max(0, Math.floor(options.camperCount));
  const weekdayIndex = clamp(Math.round(options.weekdayIndex), 0, 4);
  if (camperCount <= 0) {
    return { rows: [], expectedRows: 0, detectedRows: 0, warning: "No campers on this sheet." };
  }

  const gray = downsampleGray(rgbaToGray(image), 900);
  const x0 = Math.floor(gray.width * 0.62);
  const x1 = gray.width;
  const y0 = Math.floor(gray.height * 0.12);
  const y1 = Math.floor(gray.height * 0.94);
  const blobs = findDarkBlobs(gray, x0, y0, x1, y1);
  const { rows: sampleRows, usedBlobs } = camperSampleRows(
    options.kind,
    camperCount,
    blobs,
    y0,
    y1,
  );
  const cx = bubbleSampleX(gray.width, options.kind, weekdayIndex);
  const rowStep =
    sampleRows.length > 1 ? Math.abs(sampleRows[1].y - sampleRows[0].y) : (y1 - y0) / Math.max(1, camperCount);
  const radius = Math.max(3, Math.min(gray.width * 0.03, rowStep * 0.22));

  const rows: PaperOmrRow[] = [];
  if (options.kind === "group") {
    for (let i = 0; i < camperCount; i += 1) {
      const sample = sampleRows[i];
      const y = sample?.y ?? 0;
      const inner = sampleDiskMean(gray, cx, y, radius * 0.7);
      rows.push({
        camperIndex: i,
        y,
        dailyFilled: isFilled(inner),
        confidence: usedBlobs ? 0.8 : 0.45,
      });
    }
  } else {
    for (let i = 0; i < camperCount; i += 1) {
      const sample = sampleRows[i];
      const y = sample?.y ?? 0;
      const amInner = sampleDiskMean(gray, cx, sample?.amY ?? y, radius * 0.7);
      const pmInner = sampleDiskMean(gray, cx, sample?.pmY ?? y, radius * 0.7);
      rows.push({
        camperIndex: i,
        y,
        amFilled: isFilled(amInner),
        pmFilled: isFilled(pmInner),
        confidence: usedBlobs ? 0.75 : 0.4,
      });
    }
  }

  const warning = usedBlobs
    ? undefined
    : "Scan alignment was estimated. Check the marked names before saving.";

  return {
    rows,
    expectedRows: camperCount,
    detectedRows: clusterYs(blobs.map((b) => b.y), 8).length,
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
