import { FlaskConical, ArrowLeft, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext";
import { isNestSandboxCompany } from "@/lib/camps";

export function NestSandboxDashboardCard() {
  const { currentCompany, sandboxMode, enterSandboxCamp, exitSandboxCamp, loading } = useCompany();

  if (loading || !currentCompany) return null;

  if (sandboxMode || isNestSandboxCompany(currentCompany.slug)) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5 shadow-card md:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">Training sandbox</CardTitle>
          </div>
          <CardDescription>
            Dummy data camp for practice — season dropdown works; camp switcher is hidden. Real
            North Shore data is not used here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => void exitSandboxCamp()}>
            <ArrowLeft className="h-4 w-4" />
            Exit sandbox — back to live camp
          </Button>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            Season 2027: ~50 demo campers + 4 buses on the transport board after running{" "}
            <code className="text-[11px]">seed_nest_sandbox_demo_data.sql</code> in Supabase.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5 shadow-card md:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Training sandbox</CardTitle>
        </div>
        <CardDescription>
          Open a separate demo day camp to try transport, menu, and other tools with fake data —
          without changing North Shore.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="gap-2" onClick={() => void enterSandboxCamp()}>
          <FlaskConical className="h-4 w-4" />
          Open training sandbox
        </Button>
      </CardContent>
    </Card>
  );
}
