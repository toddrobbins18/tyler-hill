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

  it("does not use division or grade for day camp", () => {
    expect(
      healthVisitGroupForCamper(
        { group_name: null, division: [{ name: "Pre-K" }], grade: "8th" },
        true,
      ),
    ).toBe("");
  });

  it("reads counselor name from a nested leader array", () => {
    expect(
      healthVisitCounselorForCamper({
        leader: [{ name: "Alex Rivera" }],
      }),
    ).toBe("Alex Rivera");
  });
});
