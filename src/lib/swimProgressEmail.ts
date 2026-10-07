import type { LevelRecord, SkillStatus } from "@/lib/swimProgram";
import {
  getSwimProgressLevelDef,
  type SwimProgressReportLevel,
  type SwimProgressSkillDef,
  type SwimProgressSkillGroup,
  readNestSkillStatus,
} from "@/lib/swimProgressSkills";

export function swimProgressStatusLabel(status: SkillStatus): string {
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

function renderSkillLine(skill: SwimProgressSkillDef, status: SkillStatus): string {
  const label = escapeHtml(skill.label);
  const statusLabel = swimProgressStatusLabel(status);
  const suffix = statusLabel ? ` - <strong>${escapeHtml(statusLabel)}</strong>` : " -";
  return `<p style="margin:4px 0;"><strong>${label}</strong>${suffix}</p>`;
}

function renderGroup(
  group: SwimProgressSkillGroup,
  levels: LevelRecord,
): string {
  const lines = group.skills
    .map((skill) => renderSkillLine(skill, readNestSkillStatus(levels, skill.nestKey)))
    .join("");
  return `
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
    <h3 style="margin:8px 0;font-size:15px;">${escapeHtml(group.title)}</h3>
    ${lines}
  `;
}

export type SwimProgressEmailContent = {
  subject: string;
  html: string;
  plainText: string;
};

export function buildSwimProgressEmail(params: {
  childName: string;
  campName: string;
  levelId: SwimProgressReportLevel;
  levels: LevelRecord;
}): SwimProgressEmailContent | null {
  const def = getSwimProgressLevelDef(params.levelId);
  if (!def) return null;

  const childName = params.childName.trim() || "your child";
  const campName = params.campName.trim() || "North Shore Day Camp";

  const groupHtml = def.groups.map((g) => renderGroup(g, params.levels)).join("");
  const exitHtml =
    def.exitSkills?.length ?
      `
    <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
    <h3 style="margin:8px 0;font-size:15px;">EXIT SKILLS</h3>
    ${def.exitSkills.map((s) => renderSkillLine(s, readNestSkillStatus(params.levels, s.nestKey))).join("")}
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

  const plainLines: string[] = [
    `Dear ${campName} Family,`,
    "",
    `Below is your child, ${childName}'s Swim Progress Report.`,
    "",
  ];
  for (const group of def.groups) {
    plainLines.push(group.title);
    for (const skill of group.skills) {
      const status = swimProgressStatusLabel(readNestSkillStatus(params.levels, skill.nestKey));
      plainLines.push(`- ${skill.label}${status ? ` - ${status}` : ""}`);
    }
    plainLines.push("");
  }
  if (def.exitSkills?.length) {
    plainLines.push("EXIT SKILLS");
    for (const skill of def.exitSkills) {
      const status = swimProgressStatusLabel(readNestSkillStatus(params.levels, skill.nestKey));
      plainLines.push(`- ${skill.label}${status ? ` - ${status}` : ""}`);
    }
    plainLines.push("");
  }

  return {
    subject: def.emailSubject,
    html,
    plainText: plainLines.join("\n"),
  };
}
