import { describe, expect, it } from "vitest";
import {
  cropNearWhiteBounds,
  PARENT_REMINDER_NAME,
  scaleReminderNameLayout,
} from "@/lib/parentReminderLayout";

function rgbaBuffer(width: number, height: number, fill: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return data;
}

describe("parentReminderLayout crop", () => {
  it("crops a white frame around colored content", () => {
    const width = 10;
    const height = 10;
    const data = rgbaBuffer(width, height, [255, 255, 255, 255]);
    for (let y = 2; y <= 6; y++) {
      for (let x = 3; x <= 7; x++) {
        const i = (y * width + x) * 4;
        data[i] = 30;
        data[i + 1] = 80;
        data[i + 2] = 160;
      }
    }
    const crop = cropNearWhiteBounds(data, width, height);
    expect(crop.x).toBe(1);
    expect(crop.y).toBe(0);
    expect(crop.width).toBe(9);
    expect(crop.height).toBe(9);
  });

  it("leaves the full canvas when nothing to crop", () => {
    const width = 4;
    const height = 4;
    const data = rgbaBuffer(width, height, [10, 20, 30, 255]);
    expect(cropNearWhiteBounds(data, width, height)).toEqual({ x: 0, y: 0, width, height });
  });

  it("remaps the name box after a crop", () => {
    const box = scaleReminderNameLayout(PARENT_REMINDER_NAME, { x: 100, y: 50, width: 1654, height: 2300 }, 1854, 2400);
    expect(box.x).toBeCloseTo((PARENT_REMINDER_NAME.x - 100) * (1854 / 1654));
    expect(box.y).toBeCloseTo((PARENT_REMINDER_NAME.y - 50) * (2400 / 2300));
    expect(box.width).toBeCloseTo(PARENT_REMINDER_NAME.width * (1854 / 1654));
  });
});
