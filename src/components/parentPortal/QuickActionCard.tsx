import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickActionCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  accent?: "green" | "blue" | "amber" | "navy";
};

const accentClasses = {
  green: "from-[hsl(158_35%_94%)] to-white text-[hsl(158_40%_28%)]",
  blue: "from-[hsl(210_35%_95%)] to-white text-[hsl(var(--pp-brand))]",
  amber: "from-[hsl(38_90%_94%)] to-white text-[hsl(32_70%_32%)]",
  navy: "from-[hsl(var(--pp-brand-soft))] to-white text-[hsl(var(--pp-brand-dark))]",
};

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  accent = "green",
}: QuickActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col rounded-2xl border border-[hsl(var(--pp-border))] bg-gradient-to-br p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        accentClasses[accent],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <ChevronRight className="h-5 w-5 opacity-40 transition-transform group-hover:translate-x-0.5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[hsl(var(--pp-text))]">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed pp-text-muted">{description}</p>
    </button>
  );
}
