import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusBadgeVariant, statusDisplayLabel } from "@/lib/parentPortalConstants";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusBadgeVariant(status);
  const label = statusDisplayLabel(status);

  return (
    <Badge
      variant={variant}
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        status === "submitted" &&
          "border-[hsl(38_80%_75%)] bg-[hsl(38_90%_95%)] text-[hsl(32_70%_30%)]",
        status === "acknowledged" &&
          "border-[hsl(158_40%_70%)] bg-[hsl(158_45%_92%)] text-[hsl(158_40%_28%)]",
        status === "completed" &&
          "border-[hsl(210_30%_80%)] bg-[hsl(210_30%_95%)] text-[hsl(var(--pp-brand))]",
        className,
      )}
    >
      {label}
    </Badge>
  );
}
