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
      if (area < 8 || area > (w * h) / 40) continue;
      if (aspect < 0.45 || aspect > 2.2) continue;
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

function expectedRowCount(kind: "bus" | "group", camperCount: number): number {
  return kind === "bus" ? camperCount * 2 : camperCount;
}

function rowYsForSheet(
  kind: "bus" | "group",
  camperCount: number,
  blobs: Blob[],
  roiTop: number,
  roiBottom: number,
): { ys: number[]; usedBlobs: boolean } {
  const expected = expectedRowCount(kind, camperCount);
  const medianH = blobs.length
    ? [...blobs].sort((a, b) => a.h - b.h)[Math.floor(blobs.length / 2)].h
    : Math.max(8, (roiBottom - roiTop) / Math.max(1, expected));
  const clustered = clusterYs(
    blobs.map((b) => b.y),
    Math.max(4, medianH * 0.7),
  );
  if (clustered.length >= Math.max(1, Math.round(expected * 0.7))) {
    const ys = clustered.slice(0, expected);
    while (ys.length < expected) {
      const step = ys.length > 1 ? ys[ys.length - 1] - ys[ys.length - 2] : medianH * 2;
      ys.push(ys[ys.length - 1] + step);
    }
    return { ys, usedBlobs: true };
  }
  const span = roiBottom - roiTop;
  const ys: number[] = [];
  for (let i = 0; i < expected; i += 1) {
    ys.push(roiTop + span * ((i + 0.5) / expected));
  }
  return { ys, usedBlobs: false };
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
  const { ys, usedBlobs } = rowYsForSheet(options.kind, camperCount, blobs, y0, y1);
  const colW = (x1 - x0) / 5;
  const cx = x0 + colW * weekdayIndex + colW / 2;
  const radius = Math.max(3, Math.min(colW, (y1 - y0) / Math.max(8, ys.length)) * 0.28);

  const sampleRows = ys.map((y) => {
    const inner = sampleDiskMean(gray, cx, y, radius * 0.7);
    return { y, filled: isFilled(inner), inner };
  });

  const rows: PaperOmrRow[] = [];
  if (options.kind === "group") {
    for (let i = 0; i < camperCount; i += 1) {
      const sample = sampleRows[i];
      rows.push({
        camperIndex: i,
        y: sample?.y ?? 0,
        dailyFilled: sample?.filled ?? false,
        confidence: sample ? (usedBlobs ? 0.8 : 0.45) : 0.2,
      });
    }
  } else {
    for (let i = 0; i < camperCount; i += 1) {
      const am = sampleRows[i * 2];
      const pm = sampleRows[i * 2 + 1];
      rows.push({
        camperIndex: i,
        y: am?.y ?? pm?.y ?? 0,
        amFilled: am?.filled ?? false,
        pmFilled: pm?.filled ?? false,
        confidence: usedBlobs ? 0.75 : 0.4,
      });
    }
  }

  const warning = usedBlobs
    ? undefined
    : "Scan alignment was estimated. Check the marked names before saving.";

  return {
    rows,
    expectedRows: expectedRowCount(options.kind, camperCount),
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
