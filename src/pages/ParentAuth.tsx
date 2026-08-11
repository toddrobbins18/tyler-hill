import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { useParentCompany } from "@/hooks/useParentCompany";

export default function ParentAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companyId, companySlug, loading: companyLoading } = useParentCompany();
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const q = companySlug ? `?company=${encodeURIComponent(companySlug)}` : "";
        navigate(`/parents/portal${q}`, { replace: true });
      }
    });
  }, [navigate, companySlug]);

  const portalPath = companySlug ? `/parents/portal?company=${encodeURIComponent(companySlug)}` : "/parents/portal";

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

  if (companyLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Camp not found</CardTitle>
            <CardDescription>
              Open the Parent Portal using the link from your camp&apos;s sidebar (Login / Signup under Parent Facing).
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Parent Portal</CardTitle>
          <CardDescription>Manage pickups, absences & authorized adults</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Log In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="pl-email">Email</Label>
                  <Input id="pl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pl-password">Password</Label>
                  <Input id="pl-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <Button type="button" variant="link" className="w-full text-xs" onClick={handleForgotPassword}>
                  Forgot password?
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ps-family">Family Last Name</Label>
                  <Input id="ps-family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-contact">Your Full Name</Label>
                  <Input id="ps-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-phone">Phone</Label>
                  <Input id="ps-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-email">Email</Label>
                  <Input id="ps-email" type="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ps-password">Password</Label>
                  <Input id="ps-password" type="password" value={suPassword} onChange={(e) => setSuPassword(e.target.value)} minLength={6} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Parent Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
