import { describe, expect, it } from "vitest";
import {
  compareDayCampGradesByLabels,
  getDayCampGradeSortIndex,
  isCoedYoungDayCampGrade,
  normalizeDayCampGradeKey,
  resolveDayCampGradeSortLabel,
} from "@/lib/divisionFilterUtils";

describe("divisionFilterUtils day-camp grades", () => {
  it("normalizes Pre-K and Kindergarten variants", () => {
    expect(normalizeDayCampGradeKey("Pre - K")).toBe("pre-k");
    expect(normalizeDayCampGradeKey("prek")).toBe("pre-k");
    expect(normalizeDayCampGradeKey("PK")).toBe("pre-k");
    expect(normalizeDayCampGradeKey("K")).toBe("kindergarten");
    expect(normalizeDayCampGradeKey("Kindergarten")).toBe("kindergarten");
    expect(normalizeDayCampGradeKey("kg")).toBe("kindergarten");
  });

  it("sorts Nursery before Pre-K before Kindergarten", () => {
    expect(getDayCampGradeSortIndex("Nursery")).toBeLessThan(getDayCampGradeSortIndex("Pre - K"));
    expect(getDayCampGradeSortIndex("Pre - K")).toBeLessThan(
      getDayCampGradeSortIndex("Kindergarten"),
    );
  });

  it("prefers child grade when division is a bunk/group name", () => {
    expect(resolveDayCampGradeSortLabel("Paris", "Pre - K")).toBe("Pre - K");
    expect(
      compareDayCampGradesByLabels("Paris", "Pre - K", "Milan", "Kindergarten"),
    ).toBeLessThan(0);
    expect(
      compareDayCampGradesByLabels("Milan", "Kindergarten", "Paris", "Pre - K"),
    ).toBeGreaterThan(0);
  });

  it("treats youngest grades as coed for bunking", () => {
    expect(isCoedYoungDayCampGrade("Pre - K")).toBe(true);
    expect(isCoedYoungDayCampGrade("Kindergarten")).toBe(true);
    expect(isCoedYoungDayCampGrade("1st")).toBe(false);
  });
});
