/** Keep in sync with src/lib/swimBraceletEmail.ts */

export type BraceletPayload = {
  name: string;
  divisionLeader: string;
  currentBracelet: string;
  note1: string;
  note2: string;
  note3: string;
  note4: string;
  note5: string;
  date1: string;
  date2: string;
  date3: string;
  date4: string;
  date5: string;
};

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

export function buildSwimBraceletEmail(record: BraceletPayload): { subject: string; html: string; plainText: string } {
  const name = record.name.trim() || "Camper";
  const bracelet = record.currentBracelet.trim() || "Swim";
  const subject = `${name} - Swim Bracelet`;

  const lines = [1, 2, 3, 4, 5].map((n) => {
    const note = String(record[`note${n}` as keyof BraceletPayload] ?? "").trim();
    const date = formatTestDate(String(record[`date${n}` as keyof BraceletPayload] ?? ""));
    if (!note && date === "—") return "";
    return `<p style="margin:4px 0;">${escapeHtml(note || "—")} - ${escapeHtml(date)}</p>`;
  }).filter(Boolean);

  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#1f2937;line-height:1.5;">
      <p>Hi,</p>
      <p><strong>${escapeHtml(name)}</strong> tested for his/her <strong>${escapeHtml(bracelet)}</strong> Bracelet:</p>
      ${lines.join("")}
    </div>
  `.trim();

  const plainLines = [1, 2, 3, 4, 5]
    .map((n) => {
      const note = String(record[`note${n}` as keyof BraceletPayload] ?? "").trim();
      const date = formatTestDate(String(record[`date${n}` as keyof BraceletPayload] ?? ""));
      if (!note && date === "—") return "";
      return `${note || "—"} - ${date}`;
    })
    .filter(Boolean)
    .join("\n");

  return { subject, html, plainText: `Hi,\n\n${name} tested for his/her ${bracelet} Bracelet:\n\n${plainLines}` };
}

export function guessDivisionLeaderEmail(leaderName: string): string | null {
  const trimmed = leaderName.trim();
  if (!trimmed || trimmed === "—") return null;
  const first = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "");
  if (!first) return null;
  return `${first}@northshoredaycamp.com`;
}

export function braceletFromJson(childName: string, raw: Record<string, unknown>): BraceletPayload {
  return {
    name: childName,
    divisionLeader: String(raw.divisionLeader ?? "").trim(),
    currentBracelet: String(raw.currentBracelet ?? "").trim(),
    note1: String(raw.note1 ?? "").trim(),
    note2: String(raw.note2 ?? "").trim(),
    note3: String(raw.note3 ?? "").trim(),
    note4: String(raw.note4 ?? "").trim(),
    note5: String(raw.note5 ?? "").trim(),
    date1: String(raw.date1 ?? "").trim(),
    date2: String(raw.date2 ?? "").trim(),
    date3: String(raw.date3 ?? "").trim(),
    date4: String(raw.date4 ?? "").trim(),
    date5: String(raw.date5 ?? "").trim(),
  };
}
