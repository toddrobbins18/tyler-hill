import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParentPortalShell } from "@/components/parentPortal/ParentPortalShell";
import { ParentCampersView, ParentHomeView } from "@/components/parentPortal/ParentPortalViews";
import { NestSandboxParentFlowGuide } from "@/components/parentPortal/NestSandboxParentFlowGuide";
import { useParentPortalTheme } from "@/components/parentPortal/useParentPortalTheme";
import {
  SANDBOX_DEMO_PARENT_ACCOUNTS,
  SANDBOX_PARENT_DEMO_SEASON,
  fetchSandboxParentDemoRoster,
} from "@/lib/nestSandboxParentDemo";
import type { Camper, ParentPortalView } from "@/lib/parentPortalConstants";
import { resolveParentPortalHeroImageUrl } from "@/lib/parentPortalTheme";

type Props = {
  companyId: string;
  companySlug: string;
  companyName: string;
  themeColor: string | null;
  onSignOut: () => void;
};

export function ParentPortalSandboxStaffPreview({
  companyId,
  companySlug,
  companyName,
  themeColor,
  onSignOut,
}: Props) {
  const navigate = useNavigate();
  const rootRef = useParentPortalTheme(themeColor, companySlug);
  const [activeView, setActiveView] = useState<ParentPortalView>("home");
  const [demoFamilyKey, setDemoFamilyKey] = useState(SANDBOX_DEMO_PARENT_ACCOUNTS[0]?.key ?? "alpha");
  const [campers, setCampers] = useState<Camper[]>([]);
  const [loadingCampers, setLoadingCampers] = useState(true);

  const selectedAccount = useMemo(
    () => SANDBOX_DEMO_PARENT_ACCOUNTS.find((a) => a.key === demoFamilyKey) ?? SANDBOX_DEMO_PARENT_ACCOUNTS[0],
    [demoFamilyKey],
  );

  const loadPreviewCampers = useCallback(async () => {
    if (!selectedAccount) return;
    setLoadingCampers(true);
    const rows = await fetchSandboxParentDemoRoster(
      supabase,
      companyId,
      selectedAccount.email,
      SANDBOX_PARENT_DEMO_SEASON,
    );
    setCampers(rows);
    setLoadingCampers(false);
  }, [companyId, selectedAccount]);

  useEffect(() => {
    void loadPreviewCampers();
  }, [loadPreviewCampers]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  const heroImageUrl = resolveParentPortalHeroImageUrl(companySlug);
  const previewFamilyLabel = selectedAccount?.label ?? "Demo family";
  const contactName = selectedAccount?.guardianName ?? "Demo parent";

  const sharedProps = {
    campName: companyName,
    contactName,
    companyId,
    familyId: "sandbox-preview",
    campers,
    pickups: [],
    absences: [],
    authPickups: [],
    swimLessons: [],
    campUpdate: null,
    heroImageUrl,
    onSaved: loadPreviewCampers,
    onNavigate: setActiveView,
    camperName: (id: string) => campers.find((c) => c.id === id)?.name ?? "—",
  };

  return (
    <div ref={rootRef} className="parent-portal min-h-screen pp-page-bg">
      <div className="border-b border-teal-500/20 bg-teal-500/10 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="border-teal-600/40 bg-background/80">
              <Eye className="mr-1 h-3 w-3" />
              Staff training preview
            </Badge>
            <span className="text-muted-foreground">
              Showing what <strong>{previewFamilyLabel}</strong> sees after signup — not your staff account.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
              Back to Nest
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onSignOut}>
              Leave portal
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <NestSandboxParentFlowGuide companyId={companyId} companySlug={companySlug} staffSignedIn />

        <Tabs value={demoFamilyKey} onValueChange={setDemoFamilyKey}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            {SANDBOX_DEMO_PARENT_ACCOUNTS.map((a) => (
              <TabsTrigger key={a.key} value={a.key} className="text-xs sm:text-sm">
                {a.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SANDBOX_DEMO_PARENT_ACCOUNTS.map((a) => (
            <TabsContent key={a.key} value={a.key} className="mt-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Preview as parent <code className="text-xs">{a.email}</code>
                {loadingCampers ? " — loading campers…" : ` — ${campers.length} linked camper(s) on roster.`}
              </p>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <ParentPortalShell
        campName={companyName}
        familyName={`${previewFamilyLabel} (preview)`}
        contactName={contactName}
        themeColor={themeColor}
        companySlug={companySlug}
        activeView={activeView}
        onNavigate={setActiveView}
        onSignOut={onSignOut}
        mainBackdropImageUrl={activeView === "home" ? heroImageUrl : null}
      >
        {activeView === "home" && <ParentHomeView {...sharedProps} />}
        {activeView === "campers" && <ParentCampersView {...sharedProps} />}
        {activeView !== "home" && activeView !== "campers" && (
          <div className="pp-card mx-auto max-w-lg p-8 text-center text-sm pp-text-muted">
            Pickups, absences, and authorized adults require a real parent signup with{" "}
            <strong>{selectedAccount?.email}</strong>. Use the flow guide above, then sign in as that parent in
            incognito to submit requests.
            <div className="mt-4">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setActiveView("home")}>
                Back to home preview
              </Button>
            </div>
          </div>
        )}
      </ParentPortalShell>
    </div>
  );
}
