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
  | `exit:${number}`
  | `rc2Frog:${number}`
  | `rc2Toad:${number}`
  | `rc2Bullfrog:${number}`
  | `rc2Exit:${number}`
  | `rc3Perch:${number}`
  | `rc3Trout:${number}`
  | `rc3Bass:${number}`
  | `rc3Exit:${number}`
  | `rc4Wahoo:${number}`
  | `rc4Barracuda:${number}`
  | `rc4Exit:${number}`;

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

/** Red Cross 2 — Frog 2A / Toad 2B / Bullfrog 2C (`public/swim-charts/red-cross-2.jpg`). */
export const RED_CROSS_2_PROGRESS: SwimProgressLevelDef = {
  levelId: "red-cross-2",
  emailSubject: "Swim Progress Report — Red Cross Level 2",
  chartTitle: "Red Cross Level 2 – Fundamental Aquatic Skills",
  chartAssetFile: "red-cross-2.jpg",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross swim level your child is working toward mastering.',
  attachmentBlurb:
    "We've attached a skills sheet for Red Cross Level 2, so you can see all the skills required to complete this level.",
  groups: [
    {
      id: "frog",
      title: "FROG LEVEL 2A",
      skills: [
        { id: "2A1", label: "Enter by stepping or jumping from the side", nestKey: "rc2Frog:0" },
        { id: "2A2", label: "Exit using ladder, steps, or side", nestKey: "rc2Frog:1" },
        { id: "2A3", label: "Fully submerge and hold breath, 10 seconds", nestKey: "rc2Frog:2" },
        { id: "2A4", label: "Bobbing, 10 times", nestKey: "rc2Frog:3" },
        { id: "2A5", label: "Open eyes underwater to retrieve submerged object", nestKey: "rc2Frog:4" },
      ],
    },
    {
      id: "toad",
      title: "TOAD LEVEL 2B",
      skills: [
        { id: "2B1", label: "Superman float with glide, 2 body lengths", nestKey: "rc2Toad:0" },
        { id: "2B2", label: "Recover from front float to a standing position", nestKey: "rc2Toad:1" },
        { id: "2B3", label: "Back float, 15 seconds", nestKey: "rc2Toad:2" },
        { id: "2B4", label: "Recover from back to a standing position", nestKey: "rc2Toad:3" },
        { id: "2B5", label: "Roll from front to back and back to front", nestKey: "rc2Toad:4" },
      ],
    },
    {
      id: "bullfrog",
      title: "BULLFROG LEVEL 2C",
      skills: [
        { id: "2C1", label: "Rotary breathing with beginning arm action, 5 times", nestKey: "rc2Bullfrog:0" },
        { id: "2C2", label: "Back glide, 2 body lengths", nestKey: "rc2Bullfrog:1" },
        { id: "2C3", label: "Tread water, 15 seconds", nestKey: "rc2Bullfrog:2" },
        { id: "2C4", label: "Combined arm and leg action on front for 5 body lengths", nestKey: "rc2Bullfrog:3" },
        { id: "2C5", label: "Combined arm and leg action on back for 5 body lengths", nestKey: "rc2Bullfrog:4" },
      ],
    },
  ],
  exitSkills: [
    {
      id: "EXIT1",
      label:
        "Step from side into chest-deep water, push off the bottom, move into a treading or floating position for at least 15 seconds, swim on front or back for 5 body lengths, then exit the water.",
      nestKey: "rc2Exit:0",
    },
    {
      id: "EXIT2",
      label: "Move into a back float for 15 seconds, roll to front, then recover to a vertical position.",
      nestKey: "rc2Exit:1",
    },
    {
      id: "EXIT3",
      label:
        "Push off and swim using combined arm and leg actions on front for 5 body lengths, roll to back float for 15 seconds, roll to the front, then continue swimming for 5 body lengths.",
      nestKey: "rc2Exit:2",
    },
  ],
};

/** Red Cross 3 — Perch 3A / Trout 3B / Bass 3C (`public/swim-charts/red-cross-3.jpg`). */
export const RED_CROSS_3_PROGRESS: SwimProgressLevelDef = {
  levelId: "red-cross-3",
  emailSubject: "Swim Progress Report — Red Cross Level 3",
  chartTitle: "Red Cross Level 3 – Stroke Development",
  chartAssetFile: "red-cross-3.jpg",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross swim level your child is working toward mastering.',
  attachmentBlurb:
    "We've attached a skills sheet for Red Cross Level 3, so you can see all the skills required to complete this level.",
  groups: [
    {
      id: "perch",
      title: "PERCH LEVEL 3A",
      skills: [
        { id: "3A1", label: "Jump in, recover to surface, and return to side of pool", nestKey: "rc3Perch:0" },
        { id: "3A2", label: "Superman push off with flutter kick for 3 body lengths", nestKey: "rc3Perch:1" },
        { id: "3A3", label: "Back float for 15 seconds", nestKey: "rc3Perch:2" },
        { id: "3A4", label: "Tread water for 15 seconds", nestKey: "rc3Perch:3" },
        { id: "3A5", label: "Elementary backstroke arm action", nestKey: "rc3Perch:4" },
        { id: "3A6", label: "Bobbing while moving toward safety, 15 times", nestKey: "rc3Perch:5" },
      ],
    },
    {
      id: "trout",
      title: "TROUT LEVEL 3B",
      skills: [
        { id: "3B1", label: "Headfirst sitting entry", nestKey: "rc3Trout:0" },
        { id: "3B2", label: "Superman push off with dolphin kick for 3 body lengths", nestKey: "rc3Trout:1" },
        { id: "3B3", label: "Back float for 30 seconds", nestKey: "rc3Trout:2" },
        { id: "3B4", label: "Tread water for 30 seconds", nestKey: "rc3Trout:3" },
        { id: "3B5", label: "Survival float on front, 30 seconds", nestKey: "rc3Trout:4" },
        { id: "3B6", label: "Elementary backstroke leg action", nestKey: "rc3Trout:5" },
      ],
    },
    {
      id: "bass",
      title: "BASS LEVEL 3C",
      skills: [
        { id: "3C1", label: "Headfirst kneeling entry", nestKey: "rc3Bass:0" },
        { id: "3C2", label: "Back float for 1 minute", nestKey: "rc3Bass:1" },
        { id: "3C3", label: "Tread water for 1 minute", nestKey: "rc3Bass:2" },
        { id: "3C4", label: "Elementary backstroke for 15 yards", nestKey: "rc3Bass:3" },
        { id: "3C5", label: "Front crawl with rotary breathing for 15 yards", nestKey: "rc3Bass:4" },
        { id: "3C6", label: "Breaststroke kick for 15 yards", nestKey: "rc3Bass:5" },
        { id: "3C7", label: "Scissor kick for 15 yards", nestKey: "rc3Bass:6" },
      ],
    },
  ],
  exitSkills: [
    {
      id: "EXIT1",
      label:
        "Jump into deep water from the side, recover to the surface, maintain position by treading or floating for 1 minute, rotate one full turn then turn as necessary to orient to an exit point, level off, swim front crawl and/or elementary backstroke for 25 yards, then exit the water.",
      nestKey: "rc3Exit:0",
    },
    {
      id: "EXIT2",
      label:
        "Push off in a streamlined position then swim front crawl for 15 yards, change position and direction as necessary, swim elementary backstroke for 15 yards, then exit the water.",
      nestKey: "rc3Exit:1",
    },
  ],
};

/** Red Cross 4 — Wahoo 4A / Barracuda 4B (`public/swim-charts/red-cross-4.jpg`). */
export const RED_CROSS_4_PROGRESS: SwimProgressLevelDef = {
  levelId: "red-cross-4",
  emailSubject: "Swim Progress Report — Red Cross Level 4",
  chartTitle: "Red Cross Level 4 – Stroke Improvement",
  chartAssetFile: "red-cross-4.jpg",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross swim level your child is working toward mastering.',
  attachmentBlurb:
    "We've attached a skills sheet for Red Cross Level 4, so you can see all the skills required to complete this level.",
  groups: [
    {
      id: "wahoo",
      title: "WAHOO LEVEL 4A",
      skills: [
        { id: "4A1", label: "Headfirst entry, compact & stride positions", nestKey: "rc4Wahoo:0" },
        { id: "4A2", label: "Underwater swim for 3-5 body lengths", nestKey: "rc4Wahoo:1" },
        { id: "4A3", label: "Front crawl for 25 yards", nestKey: "rc4Wahoo:2" },
        { id: "4A4", label: "Back crawl for 15 yards", nestKey: "rc4Wahoo:3" },
        { id: "4A5", label: "Elementary backstroke for 25 yards", nestKey: "rc4Wahoo:4" },
        { id: "4A6", label: "Perform open turns", nestKey: "rc4Wahoo:5" },
      ],
    },
    {
      id: "barracuda",
      title: "BARRACUDA LEVEL 4B",
      skills: [
        { id: "4B1", label: "Tread water for 2 minutes", nestKey: "rc4Barracuda:0" },
        { id: "4B2", label: "Feet first surface dive", nestKey: "rc4Barracuda:1" },
        { id: "4B3", label: "Breaststroke for 15 yards", nestKey: "rc4Barracuda:2" },
        { id: "4B4", label: "Butterfly for 15 yards", nestKey: "rc4Barracuda:3" },
        { id: "4B5", label: "Sidestroke for 15 yards", nestKey: "rc4Barracuda:4" },
        { id: "4B6", label: "Survival swimming in deep water for 1 minute", nestKey: "rc4Barracuda:5" },
        {
          id: "4B7",
          label: "Push off in streamline position on back and dolphin kick for 3-5 body lengths",
          nestKey: "rc4Barracuda:6",
        },
      ],
    },
  ],
  exitSkills: [
    {
      id: "EXIT1",
      label:
        "Perform a feet-first entry into deep water, swim front crawl for 25 yards, change position to swim elementary backstroke for 25 yards",
      nestKey: "rc4Exit:0",
    },
    {
      id: "EXIT2",
      label: "Swim breaststroke for 15 yards, change position, and swim back crawl for 15 yards",
      nestKey: "rc4Exit:1",
    },
    {
      id: "EXIT3",
      label: "Submerge and swim a distance of 3 to 5 body lengths underwater, return to surface, then exit the water.",
      nestKey: "rc4Exit:2",
    },
    {
      id: "EXIT4",
      label: "Understand all 4 safety topics presented in this level",
      nestKey: "rc4Exit:3",
    },
  ],
};

const PROGRESS_BY_LEVEL: Partial<Record<SwimProgressReportLevel, SwimProgressLevelDef>> = {
  "red-cross-1": RED_CROSS_1_PROGRESS,
  "red-cross-2": RED_CROSS_2_PROGRESS,
  "red-cross-3": RED_CROSS_3_PROGRESS,
  "red-cross-4": RED_CROSS_4_PROGRESS,
};

export function getSwimProgressLevelDef(levelId: SwimProgressReportLevel): SwimProgressLevelDef | undefined {
  return PROGRESS_BY_LEVEL[levelId];
}

export function swimProgressEmailSupported(levelId: SwimProgressReportLevel): boolean {
  return getSwimProgressLevelDef(levelId) != null;
}

export function readNestSkillStatus(
  levels: {
    goldfish: SkillStatus[];
    minnow: SkillStatus[];
    tadpole: SkillStatus[];
    exitSkills?: SkillStatus[];
    rc2Frog?: SkillStatus[];
    rc2Toad?: SkillStatus[];
    rc2Bullfrog?: SkillStatus[];
    rc2Exit?: SkillStatus[];
    rc3Perch?: SkillStatus[];
    rc3Trout?: SkillStatus[];
    rc3Bass?: SkillStatus[];
    rc3Exit?: SkillStatus[];
    rc4Wahoo?: SkillStatus[];
    rc4Barracuda?: SkillStatus[];
    rc4Exit?: SkillStatus[];
  },
  nestKey?: SwimProgressNestKey,
): SkillStatus {
  if (!nestKey) return "—";
  const [group, indexStr] = nestKey.split(":") as [string, string];
  const index = Number(indexStr);
  const byGroup: Record<string, SkillStatus[] | undefined> = {
    goldfish: levels.goldfish,
    minnow: levels.minnow,
    tadpole: levels.tadpole,
    exit: levels.exitSkills,
    rc2Frog: levels.rc2Frog,
    rc2Toad: levels.rc2Toad,
    rc2Bullfrog: levels.rc2Bullfrog,
    rc2Exit: levels.rc2Exit,
    rc3Perch: levels.rc3Perch,
    rc3Trout: levels.rc3Trout,
    rc3Bass: levels.rc3Bass,
    rc3Exit: levels.rc3Exit,
    rc4Wahoo: levels.rc4Wahoo,
    rc4Barracuda: levels.rc4Barracuda,
    rc4Exit: levels.rc4Exit,
  };
  const arr = byGroup[group];
  if (!arr || !Number.isFinite(index)) return "—";
  return arr[index] ?? "—";
}
