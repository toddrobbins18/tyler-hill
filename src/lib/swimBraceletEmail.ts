import type { BraceletColor, BraceletRecord } from "@/lib/swimProgram";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTestDate(raw: string): string {
  const t = raw.trim();
  if (!t) return "—";
  return t;
}

export type SwimBraceletEmailContent = {
  subject: string;
  html: string;
  plainText: string;
};

/** Airtable Swim Bracelets 2026 — division leader notice. */
export function buildSwimBraceletEmail(params: {
  record: Pick<
    BraceletRecord,
    | "name"
    | "currentBracelet"
    | "note1"
    | "note2"
    | "note3"
    | "note4"
    | "note5"
    | "date1"
    | "date2"
    | "date3"
    | "date4"
    | "date5"
  >;
}): SwimBraceletEmailContent {
  const name = params.record.name.trim() || "Camper";
  const bracelet = (params.record.currentBracelet || "Swim") as BraceletColor | "Swim";
  const subject = `${name} - Swim Bracelet`;

  const lines = [1, 2, 3, 4, 5].map((n) => {
    const note = String(params.record[`note${n}` as keyof typeof params.record] ?? "").trim();
    const date = formatTestDate(String(params.record[`date${n}` as keyof typeof params.record] ?? ""));
    if (!note && date === "—") return "";
    return `<p style="margin:4px 0;">${escapeHtml(note || "—")} - ${escapeHtml(date)}</p>`;
  }).filter(Boolean);

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#1f2937;line-height:1.5;">
      <p>Hi,</p>
      <p><strong>${escapeHtml(name)}</strong> tested for his/her <strong>${escapeHtml(String(bracelet))}</strong> Bracelet:</p>
      ${lines.join("")}
    </div>
  `.trim();

  const plainLines = [1, 2, 3, 4, 5]
    .map((n) => {
      const note = String(params.record[`note${n}` as keyof typeof params.record] ?? "").trim();
      const date = formatTestDate(String(params.record[`date${n}` as keyof typeof params.record] ?? ""));
      if (!note && date === "—") return "";
      return `${note || "—"} - ${date}`;
    })
    .filter(Boolean)
    .join("\n");

  const plainText = `Hi,\n\n${name} tested for his/her ${bracelet} Bracelet:\n\n${plainLines}`;

  return { subject, html, plainText };
}

/** Guess leader inbox when staff roster has no email (Airtable uses firstname@northshoredaycamp.com). */
export function guessDivisionLeaderEmail(leaderName: string): string | null {
  const trimmed = leaderName.trim();
  if (!trimmed || trimmed === "—") return null;
  const first = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  if (!first) return null;
  return `${first}@northshoredaycamp.com`;
}
