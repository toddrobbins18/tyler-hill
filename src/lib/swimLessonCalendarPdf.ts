import jsPDF from "jspdf";
import { swimLessonStatusLabel } from "@/lib/swimLessonApproval";
import {
  SWIM_CALENDAR_TIME_COLUMNS,
  groupLessonsBySwimSlot,
  monFriDatesForEnrollmentWeek,
  swimSlotKey,
  type SwimCalendarLesson,
} from "@/lib/swimLessonCalendar";
import type { EnrollmentWeekCalendar } from "@/lib/enrollmentWeekCalendar";

function formatSlotCell(lessons: SwimCalendarLesson[]): string {
  if (lessons.length === 0) return "—";
  return lessons
    .map((l) => {
      const inst = l.instructor?.trim() || "?";
      const status = swimLessonStatusLabel(l.status);
      return `${l.camperName} (${inst}, ${status})`;
    })
    .join("\n");
}

export function buildSwimLessonCalendarSlotsPdf(options: {
  companyName: string;
  season: string;
  weekNumber: number;
  weekRangeLabel: string;
  calendar: EnrollmentWeekCalendar;
  lessons: SwimCalendarLesson[];
  filterSummary?: string;
}): { blob: Blob; filename: string } | null {
  const weekDays = monFriDatesForEnrollmentWeek(options.calendar, options.weekNumber);
  if (weekDays.length === 0) return null;

  const slotMap = groupLessonsBySwimSlot(options.lessons);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const timeCols = SWIM_CALENDAR_TIME_COLUMNS;

  const dayColW = 28;
  const timeColW = (pageWidth - margin * 2 - dayColW) / timeCols.length;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(options.companyName, margin, y);
  doc.setFontSize(10);
  doc.text("Swim lesson calendar — by time slot", pageWidth - margin, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const meta = [
    `Season ${options.season}`,
    `Week ${options.weekNumber}`,
    options.weekRangeLabel,
  ];
  if (options.filterSummary) meta.push(options.filterSummary);
  doc.text(meta.join("  ·  "), margin, y);
  y += 6;

  doc.setLineWidth(0.25);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  const headerH = 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("Day", margin + 1, y + 5);
  timeCols.forEach((col, i) => {
    const x = margin + dayColW + i * timeColW;
    doc.text(col.label, x + timeColW / 2, y + 5, { align: "center" });
  });
  y += headerH;
  doc.line(margin, y, pageWidth - margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);

  for (const day of weekDays) {
    const rowHeights = timeCols.map((col) => {
      const cell = formatSlotCell(slotMap.get(swimSlotKey(day.ymd, col.value)) ?? []);
      const lines = doc.splitTextToSize(cell, timeColW - 2) as string[];
      return Math.max(10, lines.length * 3.2 + 4);
    });
    const rowH = Math.max(...rowHeights);

    if (y + rowH > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(day.label, margin + 1, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);

    timeCols.forEach((col, i) => {
      const x = margin + dayColW + i * timeColW;
      const lessons = slotMap.get(swimSlotKey(day.ymd, col.value)) ?? [];
      const cell = formatSlotCell(lessons);
      const lines = doc.splitTextToSize(cell, timeColW - 2) as string[];
      let cy = y + 4;
      for (const line of lines.slice(0, 8)) {
        doc.text(line, x + 1, cy);
        cy += 3.2;
      }
      if (lines.length > 8) {
        doc.text(`+${lines.length - 8} more`, x + 1, cy);
      }
    });

    y += rowH;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setDrawColor(0);
  }

  const safeWeek = String(options.weekNumber);
  return {
    blob: doc.output("blob"),
    filename: `swim-lesson-calendar-week-${safeWeek}.pdf`,
  };
}
