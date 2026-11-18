import { describe, expect, it } from "vitest";
import {
  childToGroupReportCamper,
  reportCampersForBusRoster,
  sessionSummaryForCampers,
  type TransportReportChildRow,
} from "@/lib/transportReportData";

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

  it("prints 2027 campers one grade ahead of the stored 2026 grade", () => {
    const row = childToGroupReportCamper(child, "", "2027");
    expect(row.demographicsLine).toContain("1st");
    expect(row.demographicsLine).not.toContain("Kindergarten");
    expect(childToGroupReportCamper(child, "", "2026").demographicsLine).toContain("Kindergarten");
  });

  it("keeps mixed sessions as separate labels", () => {
    expect(
      sessionSummaryForCampers([
        { session: "Full 8 Weeks" },
        { session: "3, 4, 5, 6" },
        { session: "2, 3, 4, 5, 6, 7, 8" },
      ]),
    ).toBe("Full 8 Weeks · Weeks 3–6 · Weeks 2–8");
  });
});
