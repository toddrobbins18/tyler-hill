import { describe, expect, it } from "vitest";
import { routeStopListLines } from "@/lib/transportStopTimes";

describe("routeStopListLines", () => {
  it("shows camper names with street address", () => {
    const lines = routeStopListLines(
      {
        name: "2 Cambridge Ave",
        address: "2 Cambridge Ave, Port Washington, NY",
        camperNames: ["Alex Smith", "Jamie Smith"],
        passengers: 2,
      },
      { isCamp: false },
    );
    expect(lines.title).toBe("Alex Smith, Jamie Smith");
    expect(lines.subtitle).toBe("2 Cambridge Ave");
    expect(lines.isOpenStop).toBe(false);
  });

  it("shows open stop hint when no campers assigned", () => {
    const lines = routeStopListLines(
      {
        name: "50 Ashwood Rd",
        address: "50 Ashwood Rd, Port Washington, NY",
        passengers: 0,
      },
      { isCamp: false },
    );
    expect(lines.title).toBe("50 Ashwood Rd");
    expect(lines.subtitle).toContain("Open stop");
    expect(lines.isOpenStop).toBe(true);
  });
});
