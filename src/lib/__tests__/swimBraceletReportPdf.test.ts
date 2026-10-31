import { describe, expect, it } from "vitest";
import {
  buildSwimBraceletReportPdf,
  filterBraceletRecordsByColors,
} from "@/lib/swimBraceletReportPdf";
import type { BraceletRecord } from "@/lib/swimProgram";

const sample: BraceletRecord = {
  id: "1",
  personId: "p1",
  name: "Test Camper",
  group: "Cheetahs",
  divisionLeader: "Leader A",
  currentBracelet: "Orange",
  generalNote: "",
  proctor1: "VS",
  date1: "7/1",
  note1: "",
  proctor2: "",
  date2: "",
  note2: "",
  proctor3: "",
  date3: "",
  note3: "",
  proctor4: "",
  date4: "",
  note4: "",
  proctor5: "",
  date5: "",
  note5: "",
  emailSent: false,
};

describe("swimBraceletReportPdf", () => {
  it("filterBraceletRecordsByColors keeps matching colors", () => {
    const red = { ...sample, id: "2", currentBracelet: "Red" as const };
    const out = filterBraceletRecordsByColors([sample, red], ["Orange"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("Test Camper");
  });

  it("buildSwimBraceletReportPdf returns blob", () => {
    const built = buildSwimBraceletReportPdf({
      companyName: "Test Camp",
      season: "2027",
      reportTitle: "Orange only",
      records: [sample],
    });
    expect(built?.blob.size).toBeGreaterThan(500);
  });
});
