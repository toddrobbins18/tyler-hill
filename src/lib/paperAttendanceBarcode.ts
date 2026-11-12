import { rgbaToGray, type RgbaImage } from "@/lib/paperAttendanceOmr";

/** CODE39 patterns (* = narrow/wide unit sequence). */
const CODE39: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "*": "nwnnwnwnn",
};

const CODE39_DECODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE39).map(([ch, pattern]) => [pattern, ch]),
);

function fillRect(image: RgbaImage, x: number, y: number, w: number, h: number, gray: number) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(image.width, Math.ceil(x + w));
  const y1 = Math.min(image.height, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const i = (py * image.width + px) * 4;
      image.data[i] = gray;
      image.data[i + 1] = gray;
      image.data[i + 2] = gray;
      image.data[i + 3] = 255;
    }
  }
}

/** Draw a Code 39 barcode into an RGBA buffer (tests + synthetic scans). */
export function rasterCode39(
  image: RgbaImage,
  x: number,
  y: number,
  payload: string,
  options?: { narrow?: number; height?: number },
): void {
  const text = payload.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (!text) return;
  const encoded = `*${text}*`;
  const narrow = options?.narrow ?? 2;
  const wide = narrow * 3;
  const barH = options?.height ?? 18;
  let cx = x;
  for (const ch of encoded) {
    const pattern = CODE39[ch];
    if (!pattern) continue;
    let isBar = true;
    for (const unit of pattern) {
      const w = unit === "w" ? wide : narrow;
      if (isBar) fillRect(image, cx, y, w, barH, 0);
      cx += w;
      isBar = !isBar;
    }
    cx += narrow;
  }
}

function runsFromBits(bits: number[]): Array<{ value: number; len: number }> {
  if (!bits.length) return [];
  const runs: Array<{ value: number; len: number }> = [{ value: bits[0], len: 1 }];
  for (let i = 1; i < bits.length; i += 1) {
    const last = runs[runs.length - 1];
    if (bits[i] === last.value) last.len += 1;
    else runs.push({ value: bits[i], len: 1 });
  }
  return runs;
}

function classifyNine(lens: number[]): string | null {
  if (lens.length !== 9) return null;
  const widest = lens
    .map((len, i) => ({ len, i }))
    .sort((a, b) => b.len - a.len)
    .slice(0, 3);
  const pattern = Array(9).fill("n");
  for (const item of widest) pattern[item.i] = "w";
  return pattern.join("");
}

function tryDecodeRuns(runs: Array<{ value: number; len: number }>, offset: number): string | null {
  let i = offset;
  const chars: string[] = [];
  while (i + 9 <= runs.length) {
    if (runs[i].value !== 1) return null;
    const pattern = classifyNine(runs.slice(i, i + 9).map((r) => r.len));
    if (!pattern) return null;
    const ch = CODE39_DECODE[pattern];
    if (!ch) return null;
    chars.push(ch);
    i += 9;
    if (i < runs.length && runs[i].value === 0) i += 1;
    if (chars[0] === "*" && ch === "*" && chars.length >= 3) break;
    if (chars.length > 28) return null;
  }
  if (chars.length < 3 || chars[0] !== "*" || chars[chars.length - 1] !== "*") return null;
  return chars.slice(1, -1).join("");
}

function decodeCode39FromBits(bits: number[]): string | null {
  const forward = runsFromBits(bits);
  for (let offset = 0; offset < forward.length - 10; offset += 1) {
    if (forward[offset].value !== 1) continue;
    const text = tryDecodeRuns(forward, offset);
    if (text) return text;
  }
  const reversed = runsFromBits([...bits].reverse());
  for (let offset = 0; offset < reversed.length - 10; offset += 1) {
    if (reversed[offset].value !== 1) continue;
    const text = tryDecodeRuns(reversed, offset);
    if (text) return text;
  }
  return null;
}

function thresholdRow(samples: number[]): number[] {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length * 0.45)] ?? 128;
  return samples.map((v) => (v < mid - 6 ? 1 : 0));
}

function decodeFromGrayBand(
  gray: { width: number; height: number; gray: Uint8Array },
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): string | null {
  const votes = new Map<string, number>();
  const step = Math.max(1, Math.floor((y1 - y0) / 14));
  for (let y = y0; y < y1; y += step) {
    const samples: number[] = [];
    for (let x = x0; x < x1; x += 1) {
      samples.push(gray.gray[y * gray.width + x]);
    }
    const text = decodeCode39FromBits(thresholdRow(samples));
    if (text) votes.set(text, (votes.get(text) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [text, n] of votes) {
    if (n > bestN) {
      best = text;
      bestN = n;
    }
  }
  return best;
}

/** Header barcode lives top-right on bus and group sheets. */
export function decodePaperSheetBarcodeFromImage(image: RgbaImage): string | null {
  const src = rgbaToGray(image);
  const bands = [
    { x0: 0.35, y0: 0.01, x1: 0.995, y1: 0.22 },
    { x0: 0.5, y0: 0.0, x1: 1, y1: 0.16 },
    { x0: 0.2, y0: 0.02, x1: 0.98, y1: 0.28 },
  ];
  for (const band of bands) {
    const text = decodeFromGrayBand(
      src,
      Math.floor(src.width * band.x0),
      Math.floor(src.height * band.y0),
      Math.min(src.width, Math.ceil(src.width * band.x1)),
      Math.min(src.height, Math.ceil(src.height * band.y1)),
    );
    if (text) return text;
  }
  return null;
}
