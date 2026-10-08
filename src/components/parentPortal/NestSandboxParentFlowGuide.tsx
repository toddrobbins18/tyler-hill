import { useEffect, useState } from "react";
import { Copy, ExternalLink, RefreshCw, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  PARENT_PORTAL_FLOW_STEPS,
  SANDBOX_DEMO_PARENT_ACCOUNTS,
  SANDBOX_PARENT_DEMO_SEASON,
  fetchSandboxParentDemoFamiliesSummary,
  sandboxParentAuthUrl,
  type SandboxDemoFamilySummary,
} from "@/lib/nestSandboxParentDemo";
import { cn } from "@/lib/utils";

type Props = {
  companyId: string;
  companySlug: string;
  className?: string;
  /** Staff already signed into The Nest — parent signup needs a separate browser/incognito. */
  staffSignedIn?: boolean;
};

export function NestSandboxParentFlowGuide({
  companyId,
  companySlug,
  className,
  staffSignedIn = false,
}: Props) {
  const [families, setFamilies] = useState<SandboxDemoFamilySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await fetchSandboxParentDemoFamiliesSummary(supabase, companyId);
    setFamilies(rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [companyId]);

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast.success("Demo parent email copied");
    } catch {
      toast.error("Could not copy — select the email manually");
    }
  };

  const loginUrl = sandboxParentAuthUrl(companySlug);

  return (
    <Card className={cn("border-teal-500/30 bg-teal-500/5", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Parent portal — how it works (sandbox)</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Training flow mirrors production: roster email → parent signup → automatic camper link. Season{" "}
              <strong>{SANDBOX_PARENT_DEMO_SEASON}</strong> demo families below are seeded in Supabase only for
              this camp.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh counts
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="grid gap-3 md:grid-cols-2">
          {PARENT_PORTAL_FLOW_STEPS.map((s) => (
            <li
              key={s.step}
              className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 shrink-0 justify-center rounded-full p-0">
                  {s.step}
                </Badge>
                <span className="font-medium">{s.title}</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{s.detail}</p>
            </li>
          ))}
        </ol>

        {staffSignedIn ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            You are signed in as <strong>camp staff</strong>. &ldquo;Open family portal&rdquo; is a preview only — it
            does not create a parent account. To walk through signup, use an <strong>incognito window</strong> or
            sign out of staff, then use a demo parent email below.
          </p>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Demo parent accounts (dynamic from roster)
          </h3>
          <div className="grid gap-3 lg:grid-cols-3">
            {(families.length ? families : SANDBOX_DEMO_PARENT_ACCOUNTS.map((a) => ({ ...a, camperCount: 0, camperNames: [] }))).map(
              (fam) => (
                <div
                  key={fam.key}
                  className="rounded-xl border bg-card p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{fam.label}</p>
                    <Badge variant={fam.camperCount > 0 ? "default" : "secondary"}>
                      {loading ? "…" : `${fam.camperCount} camper${fam.camperCount === 1 ? "" : "s"}`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{fam.signupHint}</p>
                  <code className="block truncate rounded-md bg-muted px-2 py-1 text-xs">{fam.email}</code>
                  {fam.camperNames.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Linked when parent signs up: {fam.camperNames.join(", ")}
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">
                      No campers on file — run seed_nest_sandbox_demo_data.sql in Supabase.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => void copyEmail(fam.email)}>
                      <Copy className="h-3.5 w-3.5" />
                      Copy email
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="gap-2" asChild>
            <a href={loginUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open parent login / signup
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
