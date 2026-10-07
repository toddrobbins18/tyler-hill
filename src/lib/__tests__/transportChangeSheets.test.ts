import { describe, expect, it } from "vitest";
import {
  buildApprovedChangeSheetRows,
  buildBusAttendanceAbsentRows,
} from "@/lib/transportChangeSheets";
import { attendanceRecordKey } from "@/lib/transportBusAttendance";
import type { TransportException } from "@/lib/transportDailyOverrides";

const routeMeta = [
  { id: 3, name: "Route East", bus: "Bus 3" },
  { id: 7, name: "Route West", bus: "Bus 7" },
];

const coreStops = {
  3: [
    {
      name: "Smith house",
      address: "10 Oak St",
      lat: 40.88,
      lng: -73.64,
      pickupTime: "7:15 AM",
      passengers: 1,
      camperNames: ["Jamie Smith"],
    },
  ],
  7: [
    {
      name: "Lee house",
      address: "20 Pine St",
      lat: 40.89,
      lng: -73.65,
      pickupTime: "7:20 AM",
      passengers: 1,
      camperNames: ["Alex Lee"],
    },
  ],
};

describe("transportChangeSheets", () => {
  it("includes bus attendance absents on the matching bus change sheet", () => {
    const rows = buildBusAttendanceAbsentRows({
      overrideDate: "2027-07-07",
      runPeriod: "am",
      busAttendance: {
        [attendanceRecordKey(3, "Jamie Smith")]: "absent",
        [attendanceRecordKey(7, "Alex Lee")]: "present",
      },
      routeMeta,
      coreStops,
      selectedRouteIds: [3],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      camper: "Jamie Smith",
      bus: "Bus 3",
      route: "Route East",
      source: "Bus attendance",
      description: "Marked absent on bus",
      run: "AM",
    });
  });

  it("merges bus attendance absents into approved change sheet rows", () => {
    const exceptions: TransportException[] = [
      {
        source: "office_change",
        camperName: "Office Kid",
        label: "Office note",
      },
    ];

    const rows = buildApprovedChangeSheetRows({
      overrideDate: "2027-07-07",
      runPeriod: "am",
      exceptions,
      manual: { excluded: {}, added: {} },
      routeMeta,
      coreStops,
      selectedRouteIds: [3],
      busAttendance: {
        [attendanceRecordKey(3, "Jamie Smith")]: "absent",
      },
    });

    expect(rows.map((r) => r.camper)).toEqual(expect.arrayContaining(["Jamie Smith"]));
    expect(rows.find((r) => r.camper === "Jamie Smith")?.source).toBe("Bus attendance");
  });

  it("does not duplicate when parent absence already lists the camper", () => {
    const exceptions: TransportException[] = [
      {
        source: "parent_absence",
        camperName: "Jamie Smith",
        label: "Parent absence (acknowledged)",
      },
    ];

    const rows = buildApprovedChangeSheetRows({
      overrideDate: "2027-07-07",
      runPeriod: "am",
      exceptions,
      manual: { excluded: {}, added: {} },
      routeMeta,
      coreStops,
      selectedRouteIds: [3],
      busAttendance: {
        [attendanceRecordKey(3, "Jamie Smith")]: "absent",
      },
    });

    expect(rows.filter((r) => r.camper === "Jamie Smith")).toHaveLength(1);
    expect(rows.find((r) => r.camper === "Jamie Smith")?.source).toBe("Parent absence");
  });
});
