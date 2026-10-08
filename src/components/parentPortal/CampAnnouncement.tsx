import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCampDateTime } from "@/lib/campTime";

export type CampAnnouncementContent = {
  title: string;
  body: string;
  publishedAt?: string | null;
};

type CampAnnouncementProps = {
  campName: string;
  update?: CampAnnouncementContent | null;
  className?: string;
};

export function CampAnnouncement({ campName, update, className }: CampAnnouncementProps) {
  const hasMessage = Boolean(update?.body?.trim());
  if (!hasMessage) return null;

  return (
    <section
      className={cn("pp-camp-hero relative overflow-hidden rounded-2xl p-5 md:p-6", className)}
      aria-label="Camp update"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[hsl(var(--pp-brand)/0.08)] blur-2xl" />
      <div className="relative flex gap-4 md:gap-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--pp-brand))] text-white shadow-sm md:h-14 md:w-14">
          <Megaphone className="h-5 w-5 md:h-6 md:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--pp-brand))]">
            Camp update · {campName}
          </p>
          <h2 className="mt-1.5 text-lg font-bold leading-snug tracking-tight text-slate-900 md:text-xl">
            {update!.title}
          </h2>
          <p className="mt-2.5 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-slate-600">
            {update!.body}
          </p>
          {update?.publishedAt ? (
            <p className="mt-3 text-xs text-slate-500">
              Posted {formatCampDateTime(update.publishedAt)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
