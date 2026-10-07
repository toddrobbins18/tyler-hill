import jsPDF from "jspdf";
import type { LevelRecord } from "@/lib/swimProgram";
import {
  getSwimProgressLevelDef,
  readNestSkillStatus,
  type SwimProgressReportLevel,
  type SwimProgressSkillDef,
} from "@/lib/swimProgressSkills";

/** Checkbox position on chart image (pixels, top-left origin). */
export type SwimChartCheckbox = {
  skillId: string;
  x: number;
  y: number;
};

type ChartColumnLayout = {
  x: number;
  yStart: number;
  rowStep: number;
  skillIds: string[];
};

/** Calibrated against `public/swim-charts/red-cross-1.jpg` (793×1024). */
export const RED_CROSS_1_CHART = {
  width: 793,
  height: 1024,
  assetFile: "red-cross-1.jpg",
  columns: [
    {
      x: 0.060,
      yStart: 0.193,
      rowStep: 0.030,
      skillIds: ["1A1", "1A2", "1A3", "1A4"],
    },
    {
      x: 0.402,
      yStart: 0.193,
      rowStep: 0.030,
      skillIds: ["1B1", "1B2", "1B3", "1B4", "1B5", "1B6"],
    },
    {
      x: 0.734,
      yStart: 0.193,
      rowStep: 0.030,
      skillIds: ["1C1", "1C2", "1C3", "1C4"],
    },
  ] satisfies ChartColumnLayout[],
  /** Full-width exit skill shell icons at bottom of chart. */
  exitSkills: [
    { skillId: "EXIT1", x: 0.060, y: 0.786 },
    { skillId: "EXIT2", x: 0.060, y: 0.854 },
  ],
} as const;

function buildRedCross1Checkboxes(): SwimChartCheckbox[] {
  const { width, height, columns, exitSkills } = RED_CROSS_1_CHART;
  const boxes: SwimChartCheckbox[] = [];
  for (const col of columns) {
    col.skillIds.forEach((skillId, index) => {
      boxes.push({
        skillId,
        x: Math.round(col.x * width),
        y: Math.round((col.yStart + index * col.rowStep) * height),
      });
    });
  }
  for (const exit of exitSkills) {
    boxes.push({
      skillId: exit.skillId,
      x: Math.round(exit.x * width),
      y: Math.round(exit.y * height),
    });
  }
  return boxes;
}

export const RED_CROSS_1_CHECKBOXES = buildRedCross1Checkboxes();

export function swimChartPublicPath(levelId: SwimProgressReportLevel): string | null {
  const def = getSwimProgressLevelDef(levelId);
  if (!def) return null;
  return `/swim-charts/${def.chartAssetFile}`;
}

export function listAchievedSkillIds(levelId: SwimProgressReportLevel, levels: LevelRecord): string[] {
  const def = getSwimProgressLevelDef(levelId);
  if (!def) return [];

  const achieved: string[] = [];
  const consider = (skill: SwimProgressSkillDef) => {
    if (!skill.nestKey) return;
    if (readNestSkillStatus(levels, skill.nestKey) === "A") achieved.push(skill.id);
  };

  for (const group of def.groups) {
    for (const skill of group.skills) consider(skill);
  }
  for (const skill of def.exitSkills ?? []) consider(skill);
  return achieved;
}

export function getChartCheckboxes(levelId: SwimProgressReportLevel): SwimChartCheckbox[] {
  if (levelId === "red-cross-1") return RED_CROSS_1_CHECKBOXES;
  return [];
}

function loadChartImage(src: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error(`Failed to load chart image: ${src}`));
    img.src = src;
  });
}

function drawCheckmark(doc: jsPDF, x: number, y: number, size = 16) {
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(2.8);
  doc.setLineCap("round");
  doc.line(x, y + size * 0.55, x + size * 0.32, y + size * 0.88);
  doc.line(x + size * 0.32, y + size * 0.88, x + size * 0.95, y + size * 0.12);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || "camper";
}

export type SwimProgressPdfResult =
  | { ready: false; reason: string }
  | { ready: true; filename: string; base64: string; mimeType: "application/pdf" };

export async function buildSwimProgressPdf(params: {
  levelId: SwimProgressReportLevel;
  levels: LevelRecord;
  childName: string;
}): Promise<SwimProgressPdfResult> {
  const chartPath = swimChartPublicPath(params.levelId);
  if (!chartPath) {
    return { ready: false, reason: "No chart configured for this level" };
  }

  const checkboxes = getChartCheckboxes(params.levelId);
  if (checkboxes.length === 0) {
    return { ready: false, reason: "Checkbox layout not configured for this level" };
  }

  try {
    const chart = await loadChartImage(chartPath);
    const achieved = new Set(listAchievedSkillIds(params.levelId, params.levels));

    const doc = new jsPDF({
      orientation: chart.width >= chart.height ? "landscape" : "portrait",
      unit: "px",
      format: [chart.width, chart.height],
      hotfixes: ["px_scaling"],
    });

    doc.addImage(chart.dataUrl, "JPEG", 0, 0, chart.width, chart.height);

    for (const box of checkboxes) {
      if (achieved.has(box.skillId)) {
        drawCheckmark(doc, box.x, box.y);
      }
    }

    const pdfBase64 = doc.output("datauristring").split(",")[1] ?? "";
    if (!pdfBase64) {
      return { ready: false, reason: "Failed to encode PDF" };
    }

    const levelLabel = params.levelId.replace("red-cross-", "Red-Cross-");
    const filename = `${sanitizeFilename(params.childName)}-${levelLabel}-Skills-Chart.pdf`;

    return {
      ready: true,
      filename,
      base64: pdfBase64,
      mimeType: "application/pdf",
    };
  } catch (err) {
    return {
      ready: false,
      reason: err instanceof Error ? err.message : "Failed to build skills chart PDF",
    };
  }
}
