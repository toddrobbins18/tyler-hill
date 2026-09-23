import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useParentCompany } from "@/hooks/useParentCompany";
import { useParentPortalTheme } from "@/components/parentPortal/useParentPortalTheme";
import { userIsCampStaff } from "@/lib/parentPortalConstants";

export default function ParentAuth() {
  const navigate = useNavigate();
  const { userRoles, loading: authLoading } = useAuth();
  const { companyId, companySlug, companyName, themeColor, loading: companyLoading } =
    useParentCompany();
  const rootRef = useParentPortalTheme(themeColor, companySlug);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (authLoading) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      // Staff already signed into The Nest should preview login/signup, not skip to portal.
      if (userIsCampStaff(userRoles)) return;
      const q = companySlug ? `?company=${encodeURIComponent(companySlug)}` : "";
      navigate(`/parents/portal${q}`, { replace: true });
    });
  }, [navigate, companySlug, userRoles, authLoading]);

  const portalPath = companySlug
    ? `/parents/portal?company=${encodeURIComponent(companySlug)}`
    : "/parents/portal";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error("Missing camp link. Open Parent Portal from your camp's menu.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else navigate(portalPath);
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error("Missing camp link. Open Parent Portal from your camp's menu.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: suEmail,
      password: suPassword,
      options: {
        data: { full_name: contactName },
        emailRedirectTo: `${window.location.origin}${portalPath}`,
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      const { error: rpcErr } = await supabase.rpc("register_parent_account", {
        _company_id: companyId,
        _family_name: familyName,
        _primary_contact_name: contactName,
        _phone: phone,
      });
      if (rpcErr) {
        toast.error(rpcErr.message);
        setLoading(false);
        return;
      }
      toast.success("Welcome! Your parent account is ready.");
      navigate(portalPath);
    } else {
      toast.success("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) return toast.error("Enter your email first");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent");
  };

  if (companyLoading || authLoading) {
    return (
      <div className="parent-portal flex min-h-screen items-center justify-center pp-page-bg pp-text-muted">
        Loading…
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="parent-portal flex min-h-screen items-center justify-center pp-page-bg p-4">
        <div className="pp-card w-full max-w-md rounded-3xl p-8 shadow-lg">
          <h1 className="text-xl font-semibold">Camp not found</h1>
          <p className="pp-text-muted mt-2 text-sm">
            Open the Parent Portal using the link from your camp&apos;s menu (Parent Facing → Login / Signup).
          </p>
        </div>
      </div>
    );
  }

  const isStaffPreview = userIsCampStaff(userRoles);

  return (
    <div ref={rootRef} className="parent-portal relative min-h-screen overflow-hidden pp-page-bg">
      {isStaffPreview && (
        <div className="relative z-20 border-b border-[hsl(var(--pp-brand)/0.15)] bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm pp-text-muted">
              <span className="font-medium text-foreground">Staff preview</span> — this is the login and
              signup page parents see.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate("/")}
              >
                Back to The Nest
              </Button>
              <Button
                type="button"
                size="sm"
                className="pp-btn-primary rounded-full"
                onClick={() => navigate(portalPath)}
              >
                Open family portal
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0">
        <div className="pp-accent-blur-a absolute -right-20 top-0 h-72 w-72 rounded-full blur-3xl" />
        <div className="pp-accent-blur-b absolute bottom-0 left-0 h-64 w-64 rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium pp-text-muted shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Family portal
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight xl:text-5xl">
            Your family&apos;s home at {companyName}
          </h1>
          <p className="pp-text-muted mt-4 max-w-lg text-base leading-relaxed">
            Manage pickups, report absences, update authorized adults, and confirm swim lessons — all in one
            thoughtfully designed place built for camp families.
          </p>
          <ul className="pp-text-muted mt-8 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--pp-brand-soft))] text-[hsl(var(--pp-brand))]">✓</span>
              See today&apos;s schedule at a glance
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--pp-brand-soft))] text-[hsl(var(--pp-brand))]">✓</span>
              Submit pickup and absence requests
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--pp-brand-muted))] text-[hsl(var(--pp-brand-dark))]">✓</span>
              Keep authorized pickup contacts up to date
            </li>
          </ul>
        </section>

        <section className="pp-card mx-auto w-full max-w-md rounded-3xl bg-white/95 p-6 shadow-xl backdrop-blur-sm md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="pp-brand-bg flex h-12 w-12 items-center justify-center rounded-2xl">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">{companyName}</p>
              <p className="pp-text-muted text-xs">Parent sign in</p>
            </div>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-[hsl(var(--pp-brand-subtle))]">
              <TabsTrigger value="login" className="rounded-lg">
                Log in
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg">
                Sign up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pl-email">Email</Label>
                  <Input
                    id="pl-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pl-password">Password</Label>
                  <Input
                    id="pl-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="pp-btn-primary w-full rounded-xl"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-xs"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ps-family">Family last name</Label>
                  <Input
                    id="ps-family"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-contact">Your full name</Label>
                  <Input
                    id="ps-contact"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-phone">Phone</Label>
                  <Input
                    id="ps-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-email">Email</Label>
                  <Input
                    id="ps-email"
                    type="email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-password">Password</Label>
                  <Input
                    id="ps-password"
                    type="password"
                    value={suPassword}
                    onChange={(e) => setSuPassword(e.target.value)}
                    minLength={6}
                    required
                    className="rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="pp-btn-primary w-full rounded-xl"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Create parent account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}
