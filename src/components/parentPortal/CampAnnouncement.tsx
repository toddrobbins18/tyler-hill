import { Megaphone } from "lucide-react";

type CampAnnouncementProps = {
  campName: string;
};

/** Placeholder for future camp-wide parent announcements — no fake messages. */
export function CampAnnouncement({ campName }: CampAnnouncementProps) {
  return (
    <section className="rounded-2xl border border-[hsl(var(--pp-border))] bg-gradient-to-br from-[hsl(38_90%_96%)] to-white p-5 shadow-sm md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(38_85%_88%)] text-[hsl(32_70%_32%)]">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] pp-text-subtle">
            From {campName}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">Camp updates</h2>
          <p className="mt-2 text-sm leading-relaxed pp-text-muted">
            Important announcements from camp will appear here when your camp shares them with families.
            Check back for schedule reminders, event news, and helpful updates.
          </p>
        </div>
      </div>
    </section>
  );
}
