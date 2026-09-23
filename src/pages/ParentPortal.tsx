import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useParentCompany } from "@/hooks/useParentCompany";
import { ParentPortalShell } from "@/components/parentPortal/ParentPortalShell";
import {
  ParentAbsencesView,
  ParentAuthorizedView,
  ParentCampersView,
  ParentHomeView,
  ParentPickupsView,
  ParentSwimView,
} from "@/components/parentPortal/ParentPortalViews";
import { useParentPortalTheme } from "@/components/parentPortal/useParentPortalTheme";
import {
  type Absence,
  type AuthorizedPickup,
  type Camper,
  type ParentPortalView,
  type PickupChange,
  type SwimLesson,
  userIsCampStaff,
} from "@/lib/parentPortalConstants";

function ParentPortalSkeleton({
  rootRef,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={rootRef} className="parent-portal min-h-screen pp-page-bg">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-4 py-8 md:px-6">
        <div className="h-40 rounded-3xl bg-[hsl(var(--pp-brand-muted))]" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 rounded-2xl bg-[hsl(var(--pp-brand-soft))]" />
          <div className="h-48 rounded-2xl bg-[hsl(var(--pp-brand-soft))]" />
        </div>
        <div className="h-56 rounded-2xl bg-[hsl(var(--pp-brand-soft))]" />
      </div>
    </div>
  );
}

export default function ParentPortal() {
  const { user, userRoles } = useAuth();
  const { companyId, companySlug, companyName, themeColor } = useParentCompany();
  const themeRootRef = useParentPortalTheme(themeColor, companySlug);
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ParentPortalView>("home");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string>("");
  const [contactName, setContactName] = useState<string | null>(null);
  const [campers, setCampers] = useState<Camper[]>([]);
  const [pickups, setPickups] = useState<PickupChange[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [authPickups, setAuthPickups] = useState<AuthorizedPickup[]>([]);
  const [swimLessons, setSwimLessons] = useState<SwimLesson[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    if (!user || !companyId) return;
    const { data: fam } = await supabase
      .from("families")
      .select("id, family_name, primary_contact_name")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!fam) {
      setLoading(false);
      return;
    }
    setFamilyId(fam.id);
    setFamilyName(fam.family_name);
    setContactName(fam.primary_contact_name);

    const { data: fc } = await supabase
      .from("family_children")
      .select(
        "child_id, children:child_id(id, name, grade, group_name, photo_url, status)",
      )
      .eq("family_id", fam.id);

    const linkedCampers: Camper[] = (fc ?? [])
      .map(
        (row: {
          child_id: string;
          children: Camper | null;
        }) => row.children,
      )
      .filter((c): c is Camper => !!c)
      .sort((a, b) => a.name.localeCompare(b.name));

    const camperIds = linkedCampers.map((c) => c.id);
    const swimQuery =
      camperIds.length > 0
        ? supabase
            .from("swim_lessons")
            .select("*")
            .in("camper_id", camperIds)
            .order("scheduled_at", { ascending: true })
        : Promise.resolve({ data: [] as SwimLesson[] });

    const [{ data: p }, { data: a }, { data: ap }, { data: sl }] = await Promise.all([
      supabase
        .from("pickup_changes")
        .select("*")
        .eq("family_id", fam.id)
        .order("change_date", { ascending: false }),
      supabase
        .from("absences")
        .select("*")
        .eq("family_id", fam.id)
        .order("absence_date", { ascending: false }),
      supabase.from("authorized_pickups").select("*").eq("family_id", fam.id).order("full_name"),
      swimQuery,
    ]);

    setCampers(linkedCampers);
    setPickups(p ?? []);
    setAbsences(a ?? []);
    setAuthPickups(ap ?? []);
    setSwimLessons((sl ?? []) as SwimLesson[]);
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) void loadAll();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [user, companyId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeView]);

  const handleSignOut = async () => {
    const isCampStaff = userIsCampStaff(userRoles);

    if (isCampStaff) {
      navigate("/");
      return;
    }

    await supabase.auth.signOut();
    const q = companySlug ? `?company=${encodeURIComponent(companySlug)}` : "";
    navigate(`/parents${q}`);
  };

  if (loading) {
    return <ParentPortalSkeleton rootRef={themeRootRef} />;
  }

  if (!familyId || !companyId) {
    const linkAccount = async () => {
      const defaultName =
        (user?.user_metadata as { full_name?: string })?.full_name?.split(" ").slice(-1)[0] ||
        user?.email?.split("@")[0] ||
        "My";
      if (!companyId) {
        toast.error("Missing camp context");
        return;
      }
      const { error } = await supabase.rpc("register_parent_account", {
        _company_id: companyId,
        _family_name: defaultName,
        _primary_contact_name: (user?.user_metadata as Record<string, unknown>)?.full_name ?? null,
        _phone: null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Family account created");
      setLoading(true);
      await loadAll();
    };

    return (
      <div
        ref={themeRootRef}
        className="parent-portal flex min-h-screen items-center justify-center pp-page-bg p-4"
      >
        <Card className="max-w-md rounded-3xl border-[hsl(var(--pp-border))] shadow-lg">
          <CardHeader>
            <CardTitle>Welcome to {companyName}</CardTitle>
            <CardDescription>
              Your account isn&apos;t linked to a family yet. Create your family profile to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              onClick={linkAccount}
              className="pp-btn-primary rounded-xl"
            >
              Create family & continue
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={handleSignOut}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const camperName = (id: string) => campers.find((x) => x.id === id)?.name ?? "—";

  const sharedProps = {
    campName: companyName,
    contactName,
    companyId,
    familyId,
    campers,
    pickups,
    absences,
    authPickups,
    swimLessons,
    onSaved: loadAll,
    onNavigate: setActiveView,
    camperName,
  };

  return (
    <ParentPortalShell
      campName={companyName}
      familyName={familyName}
      contactName={contactName}
      themeColor={themeColor}
      companySlug={companySlug}
      activeView={activeView}
      onNavigate={setActiveView}
      onSignOut={handleSignOut}
    >
      {activeView === "home" && <ParentHomeView {...sharedProps} />}
      {activeView === "campers" && <ParentCampersView {...sharedProps} />}
      {activeView === "pickups" && <ParentPickupsView {...sharedProps} />}
      {activeView === "absences" && <ParentAbsencesView {...sharedProps} />}
      {activeView === "authorized" && <ParentAuthorizedView {...sharedProps} />}
      {activeView === "swim" && <ParentSwimView {...sharedProps} />}
    </ParentPortalShell>
  );
}
