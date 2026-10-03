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
    <div className={cn("pp-card flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[hsl(var(--pp-border))] bg-[hsl(var(--pp-bg))] text-[hsl(var(--pp-text-muted))]">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-[hsl(var(--pp-text))]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed pp-text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
