/** Sunshine Report — Todd's JPG + positioned fields (HTML email; no heavy image libs). */

import { buildSunshineReportHtmlOverlay } from "./sunshineReportHtmlFallback.ts";
import type { SunshineReportImageInput } from "./sunshineReportImage.ts";

export type SunshineReportEmailPayload = SunshineReportImageInput & {
  campName: string;
  reportDate: string;
};

function formatReportDate(isoDate: string): string {
  const parts = isoDate.trim().split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return isoDate;
  const [year, month, day] = parts;
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
}

export async function buildSunshineReportEmail(
  params: SunshineReportEmailPayload,
): Promise<{ subject: string; html: string; imageBase64: string; renderedImage: boolean }> {
  const camperName = params.camperName.trim() || "Camper";
  const formattedDate = formatReportDate(params.reportDate);
  const subject = `NSDC Sunshine Report — ${camperName} — ${formattedDate}`;

  const { html, imageBase64 } = buildSunshineReportHtmlOverlay({
    camperName,
    activities: params.activities,
    sports: params.sports,
    lunch: params.lunch,
    bm: params.bm,
    napped: params.napped,
  });

  return { subject, html, imageBase64, renderedImage: false };
}
