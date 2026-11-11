import type { RgbaImage } from "@/lib/paperAttendanceOmr";

const MAX_SIDE = 1200;

export async function loadRgbaFromBrowserFile(file: File): Promise<RgbaImage> {
  if (file.type === "application/pdf") {
    throw new Error("Save the scan as a JPG or PNG photo of the page.");
  }
  const bitmap = await createImageBitmap(file);
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = long > MAX_SIDE ? MAX_SIDE / long : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return { width: image.width, height: image.height, data: image.data };
}
