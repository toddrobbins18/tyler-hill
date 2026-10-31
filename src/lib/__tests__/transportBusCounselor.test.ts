import { describe, expect, it } from "vitest";
import {
  filterRoutesForAssignedBus,
  isBusCounselorNavLocked,
  transportBusesMatch,
} from "@/lib/transportBusCounselor";

describe("transportBusCounselor", () => {
  const routes = [
    { id: 1, bus: "Bus 1" },
    { id: 2, bus: "Bus 2" },
  ];

  it("matches bus labels loosely", () => {
    expect(transportBusesMatch("1", "Bus 1")).toBe(true);
    expect(transportBusesMatch("bus 2", "Bus 2")).toBe(true);
  });

  it("filters to assigned bus for counselors", () => {
    const filtered = filterRoutesForAssignedBus(routes, {
      assignedBus: "1",
      canViewAll: false,
      hasTransportCoordinatorAccess: false,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(1);
  });

  it("lets transport coordinators see all routes when no assigned bus", () => {
    const filtered = filterRoutesForAssignedBus(routes, {
      assignedBus: null,
      canViewAll: false,
      hasTransportCoordinatorAccess: true,
    });
    expect(filtered).toHaveLength(2);
  });

  it("locks nav when bus attendance only and not admin", () => {
    expect(isBusCounselorNavLocked({ canViewAll: false, busAttendanceOnly: true })).toBe(true);
    expect(isBusCounselorNavLocked({ canViewAll: true, busAttendanceOnly: true })).toBe(false);
    expect(isBusCounselorNavLocked({ canViewAll: false, busAttendanceOnly: false })).toBe(false);
  });

  it("scopes bus attendance only to assigned bus even with transport permission", () => {
    const filtered = filterRoutesForAssignedBus(routes, {
      assignedBus: "Bus 2",
      canViewAll: false,
      hasTransportCoordinatorAccess: true,
      busAttendanceOnly: true,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(2);
  });
});
