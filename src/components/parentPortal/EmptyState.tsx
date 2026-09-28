import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "pp-glass flex flex-col items-center px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-[hsl(var(--pp-brand-soft))] to-[hsl(var(--pp-brand-muted))] text-[hsl(var(--pp-brand-dark))] shadow-inner ring-1 ring-[hsl(var(--pp-brand)/0.15)]">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-[hsl(var(--pp-text))]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed pp-text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
