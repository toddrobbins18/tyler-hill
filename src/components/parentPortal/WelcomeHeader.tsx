import { Sparkles } from "lucide-react";
import { formatFriendlyDate, greetingForHour } from "@/lib/parentPortalConstants";

type WelcomeHeaderProps = {
  contactName?: string | null;
  campName: string;
  subtitle?: string;
};

export function WelcomeHeader({ contactName, campName, subtitle }: WelcomeHeaderProps) {
  const firstName = contactName?.trim().split(/\s+/)[0] ?? "there";
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = formatFriendlyDate(new Date().toISOString().slice(0, 10));

  return (
    <section className="pp-hero relative overflow-hidden rounded-[1.75rem] px-6 py-8 md:px-9 md:py-10">
      <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-1/2 h-24 w-24 rounded-full bg-[hsl(var(--pp-brand))]/30 blur-xl" />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5" />
          {todayLabel}
        </div>
        <h1 className="mt-4 text-[1.75rem] font-bold leading-tight tracking-tight md:text-4xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-white/85 md:text-base">
          {subtitle ?? `Everything for your family at ${campName} — pickups, absences, and swim lessons in one place.`}
        </p>
      </div>
    </section>
  );
}
