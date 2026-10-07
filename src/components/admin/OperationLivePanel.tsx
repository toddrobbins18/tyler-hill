import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OperationStep } from "@/lib/operationLiveLog";

type OperationLivePanelProps = {
  title: string;
  subtitle?: string;
  steps: OperationStep[];
  active?: boolean;
  progressPct?: number;
  onDismiss?: () => void;
  className?: string;
};

function StepIcon({ status }: { status: OperationStep["status"] }) {
  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-sky-500 shrink-0" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  }
  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
  }
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />;
}

export default function OperationLivePanel({
  title,
  subtitle,
  steps,
  active = false,
  progressPct,
  onDismiss,
  className,
}: OperationLivePanelProps) {
  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.status === "done").length;
  const computedPct =
    progressPct ??
    (steps.length <= 1 ? (active ? 35 : 100) : Math.round((doneCount / steps.length) * 100));

  return (
    <Card
      className={cn(
        "overflow-hidden border shadow-sm",
        active ? "border-sky-500/40 bg-gradient-to-br from-sky-500/5 to-card" : "border-border/60",
        className,
      )}
    >
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {active ? <Loader2 className="h-4 w-4 animate-spin text-sky-500 shrink-0" /> : null}
              {title}
            </CardTitle>
            {subtitle ? <CardDescription className="mt-1">{subtitle}</CardDescription> : null}
          </div>
          {!active && onDismiss ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <Progress value={computedPct} className="h-1.5" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="max-h-56 overflow-y-auto rounded-lg border bg-muted/20 divide-y">
          {steps.map((step) => (
            <div key={step.id} className="flex gap-3 px-3 py-2.5 text-sm">
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-medium leading-snug",
                    step.status === "running" && "text-sky-700 dark:text-sky-300",
                    step.status === "error" && "text-destructive",
                  )}
                >
                  {step.label}
                </p>
                {step.detail ? (
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{step.detail}</p>
                ) : null}
                {step.at ? (
                  <p className="text-[10px] text-muted-foreground/80 mt-1">
                    {format(new Date(step.at), "h:mm:ss a")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
