/** Deno copy of swim progress email logic — keep in sync with src/lib/swimProgressSkills.ts + swimProgressEmail.ts */

export type SkillStatus = "A" | "W" | "—";
export type SwimProgressReportLevel = "red-cross-1" | "red-cross-2" | "red-cross-3" | "red-cross-4" | "red-cross-5" | "red-cross-6";

export type SwimProgressNestKey =
  | `goldfish:${number}`
  | `minnow:${number}`
  | `tadpole:${number}`
  | `exit:${number}`;

type SwimProgressSkillDef = {
  id: string;
  label: string;
  nestKey?: SwimProgressNestKey;
};

type SwimProgressSkillGroup = {
  id: string;
  title: string;
  skills: SwimProgressSkillDef[];
};

type SwimProgressLevelDef = {
  levelId: SwimProgressReportLevel;
  emailSubject: string;
  introParagraph: string;
  attachmentBlurb: string;
  groups: SwimProgressSkillGroup[];
  exitSkills?: SwimProgressSkillDef[];
};

export type SwimLevelPayload = {
  goldfish: SkillStatus[];
  minnow: SkillStatus[];
  tadpole: SkillStatus[];
  exitSkills: SkillStatus[];
};

const RED_CROSS_1: SwimProgressLevelDef = {
  levelId: "red-cross-1",
  emailSubject: "Swim Progress Report — Red Cross Level 1",
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

const RED_CROSS_2: SwimProgressLevelDef = {
  levelId: "red-cross-2",
  emailSubject: "Swim Progress Report",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross level your child is working toward mastering.',
  attachmentBlurb:
    "We've attached a blank skills sheet for Red Cross Level 2, so you can see all the skills required to complete this level.",
  groups: [
    {
      id: "frog",
      title: "FROG LEVEL",
      skills: [
        { id: "F1", label: "Enter by stepping or jumping from the side" },
        { id: "F2", label: "Exit using ladder, steps or side" },
        { id: "F3", label: "Full submerge and hold breath, 10 seconds" },
        { id: "F4", label: "Bobbing, 10 times" },
        { id: "F5", label: "Open eyes under water to retrieve submerged object" },
        { id: "F6", label: "FROG Level" },
      ],
    },
    {
      id: "toad",
      title: "TOAD LEVEL",
      skills: [
        { id: "TD1", label: "Superman float with glide, 2 body lengths" },
        { id: "TD2", label: "Recover from front float to a standing position" },
        { id: "TD3", label: "Back float, 15 seconds" },
        { id: "TD4", label: "Recover from back to a standing position" },
        { id: "TD5", label: "Roll from front to back and back to front" },
        { id: "TD6", label: "TOAD Level" },
      ],
    },
    {
      id: "bullfrog",
      title: "BULLFROG LEVEL",
      skills: [
        { id: "BF1", label: "Rotary breathing with beginning arm action, 5 times" },
        { id: "BF2", label: "Back glide, 2 body lengths" },
        { id: "BF3", label: "Tread water, 15 seconds" },
        { id: "BF4", label: "Combined arm and leg action on front for 5 body lengths" },
        { id: "BF5", label: "Combined arm and leg action on back for 5 body lengths" },
        { id: "BF6", label: "BULLFROG Level" },
      ],
    },
  ],
};

const RED_CROSS_4: SwimProgressLevelDef = {
  levelId: "red-cross-4",
  emailSubject: "Swim Progress Report",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross level your child is working toward mastering.',
  attachmentBlurb:
    "We've attached a blank skills sheet for Red Cross Level 4, so you can see all the skills required to complete this level.",
  groups: [
    {
      id: "wahoo",
      title: "WAHOO LEVEL",
      skills: [
        { id: "W1", label: "Headfirst entry, compact & stride positions" },
        { id: "W2", label: "Underwater swim for 3 to 5 body lengths" },
        { id: "W3", label: "Front crawl for 25 yards" },
        { id: "W4", label: "Back crawl for 15 yards" },
        { id: "W5", label: "Elementary backstroke for 25 yards" },
        { id: "W6", label: "Perform open turns" },
        { id: "W7", label: "WAHOO Level" },
      ],
    },
    {
      id: "barracuda",
      title: "BARRACUDA LEVEL",
      skills: [
        { id: "BR1", label: "Tread water for 2 minutes" },
        { id: "BR2", label: "Feet first surface dive" },
        { id: "BR3", label: "Breaststroke for 15 yards" },
        { id: "BR4", label: "Butterfly for 15 yards" },
        { id: "BR5", label: "Sidestroke for 15 yards" },
        { id: "BR6", label: "Survival swimming in deep water for 1 minute" },
        {
          id: "BR7",
          label: "Push off in streamline position on back and dolphin kick for 3-5 body lengths",
        },
        { id: "BR8", label: "BARRACUDA Level" },
      ],
    },
  ],
};

const RED_CROSS_3: SwimProgressLevelDef = {
  levelId: "red-cross-3",
  emailSubject: "Swim Progress Report",
  introParagraph:
    'We use "Animal Levels" to represent the specific Red Cross level your child is working toward mastering (i.e. Level 2 includes Frog, Toad and Bullfrog).',
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

const PROGRESS: Partial<Record<SwimProgressReportLevel, SwimProgressLevelDef>> = {
  "red-cross-1": RED_CROSS_1,
  "red-cross-2": RED_CROSS_2,
  "red-cross-3": RED_CROSS_3,
  "red-cross-4": RED_CROSS_4,
};

export function isSwimProgressReportLevel(value: string): value is SwimProgressReportLevel {
  return value.startsWith("red-cross-");
}

export function swimProgressEmailSupported(levelId: SwimProgressReportLevel): boolean {
  return PROGRESS[levelId] != null;
}

function normalizeSkillStatus(raw: unknown): SkillStatus {
  const s = String(raw ?? "").trim();
  if (s === "A" || s === "Achieved") return "A";
  if (s === "W" || s === "Working Toward" || s === "Working towards") return "W";
  return "—";
}

function parseSkillArray(raw: unknown, length: number): SkillStatus[] {
  if (!Array.isArray(raw)) return Array.from({ length }, () => "—");
  return Array.from({ length }, (_, i) => normalizeSkillStatus(raw[i]));
}

export function parseSwimLevelsJson(raw: Record<string, unknown>): SwimLevelPayload {
  return {
    goldfish: parseSkillArray(raw.goldfish, 4),
    minnow: parseSkillArray(raw.minnow, 6),
    tadpole: parseSkillArray(raw.tadpole, 4),
    exitSkills: parseSkillArray(raw.exitSkills, 2),
  };
}

function readNestSkillStatus(levels: SwimLevelPayload, nestKey?: SwimProgressNestKey): SkillStatus {
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

function statusLabel(status: SkillStatus): string {
  if (status === "A") return "Achieved";
  if (status === "W") return "Working Toward";
  return "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSwimProgressEmail(params: {
  childName: string;
  campName: string;
  levelId: SwimProgressReportLevel;
  levels: SwimLevelPayload;
}): { subject: string; html: string } | null {
  const def = PROGRESS[params.levelId];
  if (!def) return null;

  const childName = params.childName.trim() || "your child";
  const campName = params.campName.trim() || "North Shore Day Camp";

  const groupHtml = def.groups
    .map((group) => {
      const lines = group.skills
        .map((skill) => {
          const status = readNestSkillStatus(params.levels, skill.nestKey);
          const suffix = statusLabel(status) ? ` - <strong>${escapeHtml(statusLabel(status))}</strong>` : " -";
          return `<p style="margin:4px 0;"><strong>${escapeHtml(skill.label)}</strong>${suffix}</p>`;
        })
        .join("");
      return `
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
        <h3 style="margin:8px 0;font-size:15px;">${escapeHtml(group.title)}</h3>
        ${lines}
      `;
    })
    .join("");

  const exitHtml =
    def.exitSkills?.length ?
      `
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
    <h3 style="margin:8px 0;font-size:15px;">EXIT SKILLS</h3>
    ${def.exitSkills
      .map((s) => {
        const status = readNestSkillStatus(params.levels, s.nestKey);
        const suffix = statusLabel(status) ? ` - <strong>${escapeHtml(statusLabel(status))}</strong>` : " -";
        return `<p style="margin:4px 0;"><strong>${escapeHtml(s.label)}</strong>${suffix}</p>`;
      })
      .join("")}
  `
    : "";

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#1f2937;line-height:1.5;max-width:640px;">
      <p>Dear ${escapeHtml(campName)} Family,</p>
      <p>
        Below is your child, <strong>${escapeHtml(childName)}</strong>'s <strong>Swim Progress Report</strong>,
        showing the skills they can currently perform. ${escapeHtml(def.introParagraph)}
      </p>
      <p>
        You will see <strong>"Achieved"</strong> next to all of the skills your child has mastered.
        You will see <strong>"Working Toward"</strong> if your child has not yet perfected that skill.
      </p>
      <p><strong>${escapeHtml(def.attachmentBlurb)}</strong></p>
      <p>If you have any questions, please feel free to reach out.</p>
      ${groupHtml}
      ${exitHtml}
      <p style="margin-top:20px;font-size:12px;color:#6b7280;"><strong>***** THIS EMAIL IS NOT MONITORED *****</strong></p>
    </div>
  `.trim();

  return { subject: def.emailSubject, html };
}
