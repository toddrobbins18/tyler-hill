import { describe, expect, it } from "vitest";
import {
  buildCamperSheetMetaLookup,
  formatChangeSheetTransportation,
  mapRowsToMasterChangeSheetPdf,
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
    expect(pdfRows[0]).toMatchObject({
      camper: "Jamie Smith",
      transportation: "03",
      division: "1st - 2nd Boys",
      group: "Cheetahs",
      change: "has gone home early",
    });
  });
});
