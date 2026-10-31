import { describe, expect, it } from "vitest";
import { isSwimLessonLifeguardStaff } from "@/lib/swimLessonInstructors";

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
});
