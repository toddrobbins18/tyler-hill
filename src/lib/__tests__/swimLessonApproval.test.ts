import { describe, expect, it } from "vitest";
import { isSwimLessonCompleted } from "@/lib/swimLessonApproval";

describe("isSwimLessonCompleted", () => {
  const now = new Date("2027-07-08T16:00:00.000Z");

  it("moves a booked lesson to completed after its end time", () => {
    expect(
      isSwimLessonCompleted("booked", "2027-07-08T15:00:00.000Z", 30, now),
    ).toBe(true);
  });

  it("keeps an upcoming booked lesson on the booked tab", () => {
    expect(
      isSwimLessonCompleted("booked", "2027-07-08T16:30:00.000Z", 30, now),
    ).toBe(false);
  });

  it("does not complete pending requests", () => {
    expect(
      isSwimLessonCompleted("pending", "2027-07-08T15:00:00.000Z", 30, now),
    ).toBe(false);
  });
});
