import { describe, expect, it } from "vitest";
import {
  healthVisitCounselorForCamper,
  healthVisitGroupForCamper,
} from "@/lib/camperGroupDisplay";

describe("healthVisitGroupForCamper", () => {
  it("uses roster group_name first", () => {
    expect(
      healthVisitGroupForCamper(
        { group_name: "Paris", division: { name: "Pre-K" }, grade: "8th" },
        true,
      ),
    ).toBe("Paris");
  });

  it("unwraps nested division arrays from PostgREST", () => {
    expect(
      healthVisitGroupForCamper(
        { group_name: null, division: [{ name: "Pre-K" }] },
        true,
      ),
    ).toBe("Pre-K");
  });

  it("falls back to grade when group and division are empty", () => {
    expect(
      healthVisitGroupForCamper(
        { group_name: "  ", division: null, grade: "8th" },
        true,
      ),
    ).toBe("8th");
  });

  it("reads counselor name from a nested leader array", () => {
    expect(
      healthVisitCounselorForCamper({
        leader: [{ name: "Alex Rivera" }],
      }),
    ).toBe("Alex Rivera");
  });
});
