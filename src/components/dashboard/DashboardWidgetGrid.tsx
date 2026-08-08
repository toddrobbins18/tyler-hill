import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardWidgetGridProps {
  children: ReactNode;
  className?: string;
}

export function DashboardWidgetGrid({ children, className }: DashboardWidgetGridProps) {
  const items = Children.toArray(children).filter(Boolean);

  return (
    <div className={cn("grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {items}
    </div>
  );
}
