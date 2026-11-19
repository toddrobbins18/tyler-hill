import { describe, expect, it } from "vitest";
import { buildSwimProgressEmail } from "@/lib/swimProgressEmail";
import { emptyRcProgressSkills, type LevelRecord } from "@/lib/swimProgram";

const baseLevel = (): LevelRecord => ({
  id: "c1",
  personId: "p1",
  name: "Jane Doe",
  group: "Pandas",
  goldfish: ["A", "W", "—", "—"],
  goldfishLevel: "Working",
  minnow: ["A", "A", "W", "—", "—", "—"],
  minnowLevel: "Working",
  tadpole: ["—", "—", "—", "—"],
  tadpoleLevel: "—",
  redCross: "—",
  redCross2: "—",
  redCross3: "—",
  redCross4: "—",
  frog: "—",
  exitSkills: ["W", "—"],
  ...emptyRcProgressSkills(),
  lastModified: "—",
});

describe("swimProgressEmail", () => {
  it("builds Red Cross 1 email with Achieved / Working Toward labels", () => {
    const content = buildSwimProgressEmail({
      childName: "Jane Doe",
      campName: "North Shore Day Camp",
      levelId: "red-cross-1",
      levels: baseLevel(),
    });

    expect(content).not.toBeNull();
    expect(content!.subject).toContain("Red Cross Level 1");
    expect(content!.html).toContain("Jane Doe");
    expect(content!.html).toContain("Blow bubbles, 3 seconds");
    expect(content!.html).toContain("Achieved");
    expect(content!.html).toContain("Working Toward");
    expect(content!.html).toContain("GOLDFISH LEVEL 1A");
    expect(content!.html).toContain("EXIT SKILLS");
    expect(content!.html).toContain("Working Toward");
    expect(content!.plainText).toContain("EXIT SKILLS");
  });

  it("builds Red Cross 2 email with Nest A/W labels and chart skill names", () => {
    const levels = baseLevel();
    levels.rc2Frog = ["A", "W", "—", "—", "—"];
    levels.rc2Exit = ["—", "A", "W"];
    const content = buildSwimProgressEmail({
      childName: "Jane Doe",
      campName: "North Shore Day Camp",
      levelId: "red-cross-2",
      levels,
    });
    expect(content).not.toBeNull();
    expect(content!.subject).toContain("Red Cross Level 2");
    expect(content!.html).toContain("FROG LEVEL 2A");
    expect(content!.html).toContain("Enter by stepping or jumping from the side");
    expect(content!.html).toContain("Achieved");
    expect(content!.html).toContain("Working Toward");
    expect(content!.html).toContain("EXIT SKILLS");
    expect(content!.html).not.toContain("blank skills sheet");
  });
});
