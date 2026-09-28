import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickActionCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  accent?: "green" | "blue" | "amber" | "navy";
};

const accentStyles = {
  green: {
    card: "from-[hsl(158_38%_96%)] via-white to-[hsl(158_30%_98%)]",
    icon: "bg-[hsl(158_40%_90%)] text-[hsl(158_45%_28%)]",
    ring: "ring-[hsl(158_40%_85%)]",
  },
  blue: {
    card: "from-[hsl(210_40%_96%)] via-white to-[hsl(var(--pp-brand-subtle))]",
    icon: "bg-[hsl(var(--pp-brand-soft))] text-[hsl(var(--pp-brand))]",
    ring: "ring-[hsl(var(--pp-brand-muted))]",
  },
  amber: {
    card: "from-[hsl(38_92%_96%)] via-white to-[hsl(38_80%_98%)]",
    icon: "bg-[hsl(38_90%_90%)] text-[hsl(32_70%_32%)]",
    ring: "ring-[hsl(38_85%_88%)]",
  },
  navy: {
    card: "from-[hsl(var(--pp-brand-subtle))] via-white to-[hsl(210_35%_98%)]",
    icon: "bg-[hsl(var(--pp-brand-muted))] text-[hsl(var(--pp-brand-dark))]",
    ring: "ring-[hsl(var(--pp-brand-soft))]",
  },
};

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  accent = "green",
}: QuickActionCardProps) {
  const style = accentStyles[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-[1.25rem] border border-[hsl(var(--pp-border)/0.8)] bg-gradient-to-br p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]",
        style.card,
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/60 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ring-1",
            style.icon,
            style.ring,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <ChevronRight className="h-5 w-5 opacity-30 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-60" />
      </div>
      <h3 className="relative mt-4 text-base font-bold tracking-tight text-[hsl(var(--pp-text))]">
        {title}
      </h3>
      <p className="relative mt-1.5 text-sm leading-relaxed pp-text-muted">{description}</p>
    </button>
  );
}
