import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CompactInfoCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  iconClassName?: string;
  iconWrapClassName?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CompactInfoCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  iconWrapClassName,
  className,
  style,
}: CompactInfoCardProps) {
  return (
    <Card className={cn("border-white/20 bg-card/80 shadow-lg backdrop-blur-sm", className)} style={style}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={cn("shrink-0 rounded-md p-1.5", iconWrapClassName)}>
            <Icon className={cn("h-4 w-4", iconClassName)} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-0.5 text-sm font-medium leading-snug text-foreground whitespace-pre-line">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
