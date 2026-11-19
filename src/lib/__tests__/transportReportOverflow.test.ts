import { describe, expect, it } from "vitest";
import jsPDF from "jspdf";
import { buildGroupReportPdf, buildBusRosterReportPdf, buildBusRouteSummaryPdf } from "@/lib/transportCampMinderReportsPdf";
import { buildMasterChangeSheetPdf } from "@/lib/transportChangeSheetPdf";
import { buildGroupBubbleSheetPdf, buildDayBusBubbleSheetPdf } from "@/lib/transportBubbleSheetPdf";
import { buildTransportTableReportPdf } from "@/lib/transportReportPdfLayout";

const longSessions = Array.from({ length: 14 }, (_, i) => `Weeks 1, ${i + 2}-8`).join(" · ");
const longStaff = Array.from({ length: 12 }, (_, i) => `Counselor ${i + 1} Lastname`).join(", ");
const longEscorts = Array.from({ length: 8 }, (_, i) => `Escort ${i + 1}`).join(" · ");

function installOverflowGuard() {
  const overflows: string[] = [];
  const original = jsPDF.prototype.text;
  jsPDF.prototype.text = function (this: jsPDF, text, x, y, options, ...rest) {
    const pageW = this.internal.pageSize.getWidth();
    const strs = Array.isArray(text) ? text : [String(text ?? "")];
    const align = (options as { align?: string } | undefined)?.align;
    for (const raw of strs) {
      const s = String(raw);
      if (!s.trim()) continue;
      const w = this.getTextWidth(s);
      let left = Number(x) || 0;
      if (align === "center") left -= w / 2;
      if (align === "right") left -= w;
      if (left < -1 || left + w > pageW + 1) {
        overflows.push(`${s.slice(0, 80)} (w=${w.toFixed(1)} x=${left.toFixed(1)} page=${pageW.toFixed(1)})`);
      }
    }
    return original.call(this, text, x, y, options, ...rest);
  };
  return {
    overflows,
    restore() {
      jsPDF.prototype.text = original;
    },
  };
}

const camper = {
  name: "Aayhan Kazmi",
  demographicsLine: "(M|1st)",
  programLine: "",
  transportLine: "",
  contactsBlock: "Mother: Shewa Kazmi\n(C: 516-555-0100)",
  barcodeValue: "19270001",
  addressLine: "28 George Street, Roslyn Heights, NY 11577",
  divisionLine: "K",
  sessionLine: "Full 8 Weeks",
};

describe("transport report overflow", () => {
  it("keeps group, bus, bubble, change-sheet, and table text on the page", () => {
    const guard = installOverflowGuard();
    try {
      expect(
        buildGroupReportPdf({
          companyName: "North Shore Day Camp",
          season: "2027",
          weekDateRange: "Week 1 (Jun 28 - Jul 2, 2027)",
          groupName: "Unassigned",
          totalCampers: 367,
          staffNames: longStaff.split(", "),
          sessionSummary: longSessions,
          campers: [camper],
        })?.blob.size,
      ).toBeGreaterThan(800);

      expect(
        buildBusRosterReportPdf({
          companyName: "North Shore Day Camp",
          season: "2027",
          weekDateRange: "Week 1 (Jun 28 - Jul 2, 2027)",
          bus: "Bus 8",
          routeName: "Port Washington / Manorhaven / extra long route label",
          driverOrCounselor: `Driver Name · ${longEscorts}`,
          totalPassengers: 24,
          campers: [camper],
          bubbleCampers: [{ name: "Aayhan Kazmi", detail: "49 Roger Dr" }],
        })?.blob.size,
      ).toBeGreaterThan(800);

      expect(
        buildBusRouteSummaryPdf({
          companyName: "North Shore Day Camp",
          season: "2027",
          dateLabel: "Week 1 (Jun 28 - Jul 2, 2027)",
          rows: [
            {
              routeName: "Port Washington extra long",
              bus: "Bus 8",
              stopNumber: 1,
              stopName: "Kazmi house",
              address: "28 George Street, Roslyn Heights, NY 11577",
              pickupTime: "7:15 AM",
              passengers: 2,
            },
          ],
        })?.blob.size,
      ).toBeGreaterThan(400);

      expect(
        buildMasterChangeSheetPdf({
          companyName: "North Shore Day Camp",
          season: "2027",
          sheetDate: "2027-06-29",
          runPeriod: "daily",
          totalCampers: 367,
          rows: [
            {
              camper: "Aidan Sardelli",
              transportation: "08",
              division: "3rd Grade",
              group: "Villanova",
              change: "Absent (All Day)",
            },
          ],
        })?.blob.size,
      ).toBeGreaterThan(400);

      expect(
        buildGroupBubbleSheetPdf({
          companyName: "North Shore Day Camp",
          enrollmentWeek: 1,
          weekDateRange: "Jun 28 – Jul 2, 2027",
          weekDays: [
            { label: "M", sublabel: "28" },
            { label: "T", sublabel: "29" },
            { label: "W", sublabel: "30" },
            { label: "Th", sublabel: "1" },
            { label: "F", sublabel: "2" },
          ],
          groups: [{ groupName: "Unassigned", campers: [{ name: "Aayhan Kazmi", detail: "Unassigned" }] }],
        })?.blob.size,
      ).toBeGreaterThan(400);

      expect(
        buildDayBusBubbleSheetPdf({
          companyName: "North Shore Day Camp",
          date: "2027-06-29",
          enrollmentWeek: 1,
          weekDateRange: "Jun 28 – Jul 2, 2027",
          routes: [{ bus: "Bus 8", routeName: "PW", campers: [{ name: "Aidan Sardelli", detail: "49 Roger Dr" }] }],
        })?.blob.size,
      ).toBeGreaterThan(400);

      expect(
        buildTransportTableReportPdf({
          companyName: "North Shore Day Camp",
          reportTitle: "Digital Attendance Log",
          metaLines: ["2027-06-29 · AM · 12 marked in system · in progress"],
          headers: ["Bus", "Route", "Camper", "Stop", "Status"],
          dataRows: [["Bus 8", "PW", "Aidan Sardelli", "49 Roger Dr", "Absent"]],
          filenameSlug: "digital-attendance",
        }).blob.size,
      ).toBeGreaterThan(400);

      expect(guard.overflows).toEqual([]);
    } finally {
      guard.restore();
    }
  });
});
