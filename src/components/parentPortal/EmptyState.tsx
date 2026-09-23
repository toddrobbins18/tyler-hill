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
        "flex flex-col items-center rounded-2xl border border-dashed border-[hsl(var(--pp-border-strong))] bg-white/70 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(158_35%_92%)] text-[hsl(158_40%_32%)]">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-[hsl(var(--pp-text))]">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed pp-text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
