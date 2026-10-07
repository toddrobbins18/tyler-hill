import type { SkillStatus } from "@/lib/swimProgram";

/** Swim progress report levels that support parent email + chart attachment. */
export type SwimProgressReportLevel =
  | "red-cross-1"
  | "red-cross-2"
  | "red-cross-3"
  | "red-cross-4"
  | "red-cross-5"
  | "red-cross-6";

export type SwimProgressNestKey =
  | `goldfish:${number}`
  | `minnow:${number}`
  | `tadpole:${number}`
  | `exit:${number}`;

export type SwimProgressSkillDef = {
  id: string;
  label: string;
  /** Maps to LevelRecord goldfish/minnow/tadpole array index, or exit skills later. */
  nestKey?: SwimProgressNestKey;
};

export type SwimProgressSkillGroup = {
  id: string;
  title: string;
  skills: SwimProgressSkillDef[];
};

export type SwimProgressLevelDef = {
  levelId: SwimProgressReportLevel;
  emailSubject: string;
  chartTitle: string;
  /** Public path under /swim-charts/ — drop PNG/PDF here when Todd provides assets. */
  chartAssetFile: string;
  introParagraph: string;
  attachmentBlurb: string;
  groups: SwimProgressSkillGroup[];
  exitSkills?: SwimProgressSkillDef[];
};

/** Red Cross 1 — matches NSDC SPR level one skills chart. */
export const RED_CROSS_1_PROGRESS: SwimProgressLevelDef = {
  levelId: "red-cross-1",
  emailSubject: "Swim Progress Report — Red Cross Level 1",
  chartTitle: "Red Cross Level 1 – Introduction to Water Skills",
  chartAssetFile: "red-cross-1.jpg",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross swim level your child is working toward mastering.',
  attachmentBlurb:
    "We've attached a skills sheet for Red Cross Level 1, so you can see all the skills required to complete this level.",
  groups: [
    {
      id: "goldfish",
      title: "GOLDFISH LEVEL 1A",
      skills: [
        { id: "1A1", label: "Enter and exit pool using steps or side", nestKey: "goldfish:0" },
        { id: "1A2", label: "Blow bubbles, 3 seconds", nestKey: "goldfish:1" },
        { id: "1A3", label: "Bobbing, 5 times", nestKey: "goldfish:2" },
        { id: "1A4", label: "Open eyes underwater and retrieve submerged toys", nestKey: "goldfish:3" },
      ],
    },
    {
      id: "minnow",
      title: "MINNOW LEVEL 1B",
      skills: [
        { id: "1B1", label: "Front glide, 2 body lengths", nestKey: "minnow:0" },
        { id: "1B2", label: "Recover from front glide to a standing position", nestKey: "minnow:1" },
        { id: "1B3", label: "Back float, 5 seconds", nestKey: "minnow:2" },
        { id: "1B4", label: "Recover from back to a standing position", nestKey: "minnow:3" },
        { id: "1B5", label: "Roll from front to back and back to front", nestKey: "minnow:4" },
        { id: "1B6", label: "Back glide, 2 body lengths", nestKey: "minnow:5" },
      ],
    },
    {
      id: "tadpole",
      title: "TADPOLE LEVEL 1C",
      skills: [
        { id: "1C1", label: "Treading action with arms", nestKey: "tadpole:0" },
        { id: "1C2", label: "Combined arm and leg action on front, 2 body lengths", nestKey: "tadpole:1" },
        { id: "1C3", label: "Combined arm and leg action on back, 2 body lengths", nestKey: "tadpole:2" },
        { id: "1C4", label: "Safety Topics", nestKey: "tadpole:3" },
      ],
    },
  ],
  exitSkills: [
    {
      id: "EXIT1",
      label:
        "Enter independently, using either the ramp, steps or side, travel at least 5 yards, bob 5 times, then safely exit the water.",
      nestKey: "exit:0",
    },
    {
      id: "EXIT2",
      label:
        "Glide on front at least 2 body lengths, roll to a back float for 5 seconds, and recover to a vertical position.",
      nestKey: "exit:1",
    },
  ],
};

/** Red Cross 3 — email body skills (Perch / Trout / Bass). Nest skill entry UI coming later. */
export const RED_CROSS_3_PROGRESS: SwimProgressLevelDef = {
  levelId: "red-cross-3",
  emailSubject: "Swim Progress Report — Red Cross Level 3",
  chartTitle: "Red Cross Level 3",
  chartAssetFile: "red-cross-3.png",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross swim level your child is working toward mastering (i.e. Level 2 includes Frog, Toad and Bullfrog).',
  attachmentBlurb:
    "We've attached a blank skills sheet for Red Cross Level 3, so you can see all the skills required to complete this level.",
  groups: [
    {
      id: "perch",
      title: "PERCH LEVEL",
      skills: [
        { id: "P1", label: "Jump in, recover to surface, and return to side of pool" },
        { id: "P2", label: "Superman push off with flutter kick for 3 body lengths" },
        { id: "P3", label: "Back float for 15 seconds" },
        { id: "P4", label: "Tread water for 15 seconds" },
        { id: "P5", label: "Elementary backstroke arm action" },
        { id: "P6", label: "Bobbing while moving toward safety, 15 times" },
        { id: "P7", label: "PERCH Level" },
      ],
    },
    {
      id: "trout",
      title: "TROUT LEVEL",
      skills: [
        { id: "T1", label: "Headfirst sitting entry" },
        { id: "T2", label: "Superman push off with dolphin kick for 3 body lengths" },
        { id: "T3", label: "Back float for 30 seconds" },
        { id: "T4", label: "Tread water for 30 seconds" },
        { id: "T5", label: "Survival float on front, 30 seconds" },
        { id: "T6", label: "Elementary backstroke leg action" },
        { id: "T7", label: "TROUT Level" },
      ],
    },
    {
      id: "bass",
      title: "BASS LEVEL",
      skills: [
        { id: "B1", label: "Headfirst kneeling entry" },
        { id: "B2", label: "Back float for 1 minute" },
        { id: "B3", label: "Tread water for 1 minute" },
        { id: "B4", label: "Elementary backstroke for 15 yards" },
        { id: "B5", label: "Front crawl with rotary breathing for 15 yards" },
        { id: "B6", label: "Breaststroke kick for 15 yards" },
        { id: "B7", label: "Scissor kick for 15 yards" },
        { id: "B8", label: "BASS Level" },
      ],
    },
  ],
};

const PROGRESS_BY_LEVEL: Partial<Record<SwimProgressReportLevel, SwimProgressLevelDef>> = {
  "red-cross-1": RED_CROSS_1_PROGRESS,
  "red-cross-3": RED_CROSS_3_PROGRESS,
};

export function getSwimProgressLevelDef(levelId: SwimProgressReportLevel): SwimProgressLevelDef | undefined {
  return PROGRESS_BY_LEVEL[levelId];
}

export function swimProgressEmailSupported(levelId: SwimProgressReportLevel): boolean {
  return levelId === "red-cross-1";
}

export function readNestSkillStatus(
  levels: {
    goldfish: SkillStatus[];
    minnow: SkillStatus[];
    tadpole: SkillStatus[];
    exitSkills?: SkillStatus[];
  },
  nestKey?: SwimProgressNestKey,
): SkillStatus {
  if (!nestKey) return "—";
  const [group, indexStr] = nestKey.split(":") as [string, string];
  const index = Number(indexStr);
  const arr =
    group === "goldfish"
      ? levels.goldfish
      : group === "minnow"
        ? levels.minnow
        : group === "tadpole"
          ? levels.tadpole
          : group === "exit"
            ? levels.exitSkills
            : null;
  if (!arr || !Number.isFinite(index)) return "—";
  return arr[index] ?? "—";
}
