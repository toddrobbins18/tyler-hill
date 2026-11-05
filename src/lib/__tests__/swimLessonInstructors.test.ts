import { describe, expect, it } from "vitest";
import { isSwimLessonLifeguardStaff, mergeSwimInstructorNames } from "@/lib/swimLessonInstructors";

describe("isSwimLessonLifeguardStaff", () => {
  it("matches lifeguard role", () => {
    expect(isSwimLessonLifeguardStaff({ role: "Lifeguard" })).toBe(true);
  });

  it("matches waterfront specialty", () => {
    expect(isSwimLessonLifeguardStaff({ role: "Counselor", specialty_sports: ["Waterfront"] })).toBe(
      true,
    );
  });

  it("rejects general staff", () => {
    expect(isSwimLessonLifeguardStaff({ role: "Counselor", department: "Sports" })).toBe(false);
  });

  it("keeps instructors added by name alongside lifeguards", () => {
    expect(mergeSwimInstructorNames(["Ada Lifeguard"], ["Sam Coach"], ["Sam Coach"])).toEqual([
      "Ada Lifeguard",
      "Sam Coach",
    ]);
  });
});
