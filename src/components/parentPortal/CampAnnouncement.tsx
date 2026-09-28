import { Megaphone } from "lucide-react";

type CampAnnouncementProps = {
  campName: string;
};

/** Placeholder for future camp-wide parent announcements — no fake messages. */
export function CampAnnouncement({ campName }: CampAnnouncementProps) {
  return (
    <section className="pp-card overflow-hidden bg-gradient-to-br from-[hsl(38_92%_97%)] via-white to-[hsl(var(--pp-brand-subtle)/0.4)] p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(38_90%_90%)] to-[hsl(38_85%_82%)] text-[hsl(32_70%_32%)] shadow-sm ring-1 ring-[hsl(38_80%_85%)]">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <p className="pp-label">From {campName}</p>
          <h2 className="mt-1.5 text-lg font-bold tracking-tight">Camp updates</h2>
          <p className="mt-2 text-sm leading-relaxed pp-text-muted">
            Important announcements from camp will appear here when your camp shares them with families.
            Check back for schedule reminders, event news, and helpful updates.
          </p>
        </div>
      </div>
    </section>
  );
}
