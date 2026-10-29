function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SwimLessonReminderEmail = {
  subject: string;
  html: string;
  plainText: string;
};

/** Todd — 3 days before lesson if parent has not confirmed. */
export function buildSwimLessonConfirmationReminder(params: {
  childName: string;
  campName?: string;
}): SwimLessonReminderEmail {
  const name = params.childName.trim() || "your child";
  const camp = params.campName?.trim() || "North Shore Day Camp";
  const subject = "🏊 Swim Lesson Confirmation";
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#1f2937;line-height:1.5;max-width:640px;">
      <p>Hello!</p>
      <p>
        We're confirming your child's (<strong>${escapeHtml(name)}</strong>) swim lesson information.
        Please review and approve the swim lesson details through The Nest app.
      </p>
      <p>Thank you for your help in keeping our records up to date!</p>
      <p>Warmly,<br/>${escapeHtml(camp)}</p>
      <p style="margin-top:20px;font-size:12px;color:#6b7280;">
        Please do not reply to this email. This mailbox is not monitored.
      </p>
    </div>
  `.trim();
  const plainText = [
    "Hello!",
    "",
    `We're confirming your child's (${name}) swim lesson information. Please review and approve the swim lesson details through The Nest app.`,
    "",
    "Thank you for your help in keeping our records up to date!",
    "",
    `Warmly,`,
    camp,
    "",
    "Please do not reply to this email. This mailbox is not monitored.",
  ].join("\n");
  return { subject, html, plainText };
}
