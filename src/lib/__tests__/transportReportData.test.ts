import { describe, expect, it } from "vitest";
import { reportCampersForBusRoster, type TransportReportChildRow } from "@/lib/transportReportData";

const child: TransportReportChildRow = {
  id: "1",
  personId: "100",
  name: "Alina Haynes",
  groupName: "Blue Jays",
  gender: "F",
  age: 5,
  grade: "Kindergarten",
  session: "Full 8 Weeks",
  divisionName: "K",
  guardianName: "Meredith",
  guardianNameP2: null,
  guardianPhone: "555-0100",
  guardianEmail: null,
  homeAddress: "10 Oak Street, Glen Cove, NY 11542",
};

describe("reportCampersForBusRoster", () => {
  it("matches bubble-sheet riders to roster details", () => {
    const campers = reportCampersForBusRoster(
      [{ name: "Alina Haynes", detail: "Stop 1" }],
      [child],
      [],
      {},
      [],
      {},
      "Bus 1",
    );
    expect(campers).toHaveLength(1);
    expect(campers[0].name).toBe("Alina Haynes");
    expect(campers[0].demographicsLine).toContain("Kindergarten");
    expect(campers[0].contactsBlock).toContain("Meredith");
  });

  it("keeps unmatched riders on the bus list", () => {
    const campers = reportCampersForBusRoster(
      [{ name: "Unknown Kid", detail: "Stop 2" }],
      [child],
      [],
      {},
      [],
      {},
      "Bus 1",
    );
    expect(campers[0]).toMatchObject({
      name: "Unknown Kid",
      programLine: "Stop 2",
      transportLine: "Bus 1",
    });
  });
});
