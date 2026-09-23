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
    <section className="pp-hero relative overflow-hidden rounded-3xl px-6 py-7 shadow-lg md:px-8 md:py-9">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-[hsl(var(--pp-brand))]/25 blur-2xl" />

      <div className="relative">
        <p className="text-sm font-medium text-white/70">{todayLabel}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {greeting}, {firstName} 👋
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">
          {subtitle ??
            `Here's what's happening with your family at ${campName}.`}
        </p>
      </div>
    </section>
  );
}
