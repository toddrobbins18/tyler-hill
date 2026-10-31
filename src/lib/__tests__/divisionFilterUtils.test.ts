import { describe, expect, it } from "vitest";
import {
  compareDayCampGradesByLabels,
  getDayCampGradeSortIndex,
  getDayCampProgramDivisionSortIndex,
  isCoedYoungDayCampGrade,
  normalizeDayCampGradeKey,
  resolveDayCampGradeSortLabel,
  resolveDayCampProgramDivisionKey,
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

  it("maps North Shore program tiers (1/2, 3/4, Crew, CIT)", () => {
    expect(resolveDayCampProgramDivisionKey("1st")).toBe("half-12");
    expect(resolveDayCampProgramDivisionKey("2nd")).toBe("half-12");
    expect(resolveDayCampProgramDivisionKey("3rd")).toBe("half-34");
    expect(resolveDayCampProgramDivisionKey("5th")).toBe("crew");
    expect(resolveDayCampProgramDivisionKey("8th")).toBe("crew");
    expect(resolveDayCampProgramDivisionKey("Crew Boys")).toBe("crew");
    expect(resolveDayCampProgramDivisionKey("9th")).toBe("cit");
    expect(resolveDayCampProgramDivisionKey("CIT Girls")).toBe("cit");
  });

  it("sorts Crew and CIT with their grade blocks", () => {
    expect(getDayCampProgramDivisionSortIndex("5th")).toBe(
      getDayCampProgramDivisionSortIndex("Crew Boys"),
    );
    expect(getDayCampProgramDivisionSortIndex("8th")).toBeLessThan(
      getDayCampProgramDivisionSortIndex("CIT Girls"),
    );
    expect(
      compareDayCampGradesByLabels("CIT Boys", null, "8th Girls", null),
    ).toBeGreaterThan(0);
    expect(
      compareDayCampGradesByLabels("1st", null, "3rd", null),
    ).toBeLessThan(0);
  });
});
