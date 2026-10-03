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
    <header className="pb-2">
      <p className="text-sm font-medium text-slate-500">{todayLabel}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-[1.75rem]">
        {greeting}, {firstName}
      </h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-600">
        {subtitle ?? `Everything you need for ${campName} — in one place.`}
      </p>
    </header>
  );
}
