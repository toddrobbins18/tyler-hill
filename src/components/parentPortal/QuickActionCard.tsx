import { ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickActionAccent = "blue" | "amber" | "emerald" | "cyan";

type QuickActionCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  accent?: QuickActionAccent;
  className?: string;
};

const accentStyles: Record<
  QuickActionAccent,
  { bubble: string; icon: string; hoverBorder: string }
> = {
  blue: {
    bubble: "bg-blue-100 text-blue-700",
    icon: "text-blue-700",
    hoverBorder: "hover:border-blue-200",
  },
  amber: {
    bubble: "bg-amber-100 text-amber-700",
    icon: "text-amber-700",
    hoverBorder: "hover:border-amber-200",
  },
  emerald: {
    bubble: "bg-emerald-100 text-emerald-700",
    icon: "text-emerald-700",
    hoverBorder: "hover:border-emerald-200",
  },
  cyan: {
    bubble: "bg-cyan-100 text-cyan-700",
    icon: "text-cyan-700",
    hoverBorder: "hover:border-cyan-200",
  },
};

export function QuickActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  accent = "blue",
  className,
}: QuickActionCardProps) {
  const style = accentStyles[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("pp-action-card group min-h-[8.5rem] w-full", style.hoverBorder, className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105",
            style.bubble,
          )}
        >
          <Icon className={cn("h-6 w-6", style.icon)} />
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-400" />
      </div>
      <h3 className="mt-4 text-base font-bold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
    </button>
  );
}
