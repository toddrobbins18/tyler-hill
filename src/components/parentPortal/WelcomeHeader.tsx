import { formatFriendlyDate, greetingForHour } from "@/lib/parentPortalConstants";
import { cn } from "@/lib/utils";

type WelcomeHeaderProps = {
  contactName?: string | null;
  campName: string;
  subtitle?: string;
  /** When home uses full-page camp photo (staff Dashboard style). */
  onAerialBackground?: boolean;
};

export function WelcomeHeader({
  contactName,
  campName,
  subtitle,
  onAerialBackground = false,
}: WelcomeHeaderProps) {
  const firstName = contactName?.trim().split(/\s+/)[0] ?? "there";
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = formatFriendlyDate(new Date().toISOString().slice(0, 10));

  return (
    <header className={cn("pb-2", onAerialBackground && "text-white drop-shadow-md")}>
      <p className={cn("text-sm font-medium", onAerialBackground ? "text-white/85" : "text-slate-500")}>
        {todayLabel}
      </p>
      <h1
        className={cn(
          "mt-1 text-2xl font-bold tracking-tight md:text-[1.75rem]",
          onAerialBackground ? "text-white drop-shadow-lg" : "text-slate-900",
        )}
      >
        {greeting}, {firstName}
      </h1>
      <p
        className={cn(
          "mt-2 max-w-2xl text-[0.9375rem] leading-relaxed",
          onAerialBackground ? "text-white/90" : "text-slate-600",
        )}
      >
        {subtitle ?? `Everything you need for ${campName} — in one place.`}
      </p>
    </header>
  );
}
