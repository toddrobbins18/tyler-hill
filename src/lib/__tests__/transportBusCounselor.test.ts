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

  it("locks nav when assigned bus and not admin", () => {
    expect(isBusCounselorNavLocked({ canViewAll: false, assignedBus: "Bus 3" })).toBe(true);
    expect(isBusCounselorNavLocked({ canViewAll: true, assignedBus: "Bus 3" })).toBe(false);
  });
});
