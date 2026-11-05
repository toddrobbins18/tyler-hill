import { describe, expect, it } from "vitest";
import {
  buildCamperSheetMetaLookup,
  formatChangeSheetTransportation,
  mapRowsToMasterChangeSheetPdf,
  shortChangeSheetPhrase,
} from "@/lib/transportChangeSheetPdf";
import { PARENT_TRANSPORT_CHANGE_SHEET_BUS } from "@/lib/transportChangeSheets";

describe("transportChangeSheetPdf", () => {
  it("formats bus numbers and PT for the Transportation column", () => {
    expect(formatChangeSheetTransportation("Bus 3")).toBe("03");
    expect(formatChangeSheetTransportation("22")).toBe("22");
    expect(formatChangeSheetTransportation(PARENT_TRANSPORT_CHANGE_SHEET_BUS)).toBe("PT");
  });

  it("maps roster division and group onto PDF rows", () => {
    const lookup = buildCamperSheetMetaLookup([
      {
        name: "Jamie Smith",
        group_name: "Cheetahs",
        grade: null,
        division: { name: "1st - 2nd Boys" },
      },
    ]);
    const pdfRows = mapRowsToMasterChangeSheetPdf(
      [
        {
          date: "2026-07-07",
          run: "AM",
          camper: "Jamie Smith",
          source: "Parent portal",
          description: "has gone home early",
          status: "saved",
          route: "Route 3",
          bus: "Bus 3",
          stop: "10 Oak",
          notes: "",
        },
      ],
      lookup,
    );
    expect(shortChangeSheetPhrase({
      source: "Bus attendance",
      description: "Marked absent on bus",
      notes: "",
    })).toBe("Absent (All Day)");
    expect(shortChangeSheetPhrase({
      source: "Swim lesson",
      description: "Swim lesson — no PM bus (acknowledged)",
      notes: "",
    })).toBe("swim lesson");
    expect(shortChangeSheetPhrase({
      source: "Nurse — sent home",
      description: "Nurse — sent home (acknowledged)",
      notes: "",
    })).toBe("nurse sign out");
    expect(shortChangeSheetPhrase({
      source: "Office change",
      description: "Office phone change",
      notes: "to mansion at dismissal",
    })).toBe("to mansion at dismissal");

    expect(pdfRows[0]).toMatchObject({
      camper: "Jamie Smith",
      transportation: "03",
      division: "1st - 2nd Boys",
      group: "Cheetahs",
      change: "has gone home early",
    });
  });
});
