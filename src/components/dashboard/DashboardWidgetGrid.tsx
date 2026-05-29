import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardWidgetGridProps {
  children: ReactNode;
  className?: string;
  /** 3-column flow on large screens so short cards don't leave row dead space */
  balanced?: boolean;
}

export function DashboardWidgetGrid({ children, className, balanced = false }: DashboardWidgetGridProps) {
  const items = Children.toArray(children).filter(Boolean);

  if (!balanced) {
    return (
      <div className={cn("grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
        {items}
      </div>
    );
  }

  return (
    <>
      <div className={cn("grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:hidden", className)}>
        {items}
      </div>
      <div className="hidden items-start gap-4 lg:flex">
        {([0, 1, 2] as const).map((col) => (
          <div key={col} className="flex min-w-0 flex-1 flex-col gap-4">
            {items.filter((_, i) => i % 3 === col)}
          </div>
        ))}
      </div>
    </>
  );
}
