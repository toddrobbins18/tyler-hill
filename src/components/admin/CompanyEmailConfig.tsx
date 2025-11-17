import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Mail, CheckCircle, AlertCircle, Loader2, TestTube } from "lucide-react";

export default function CompanyEmailConfig() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [formData, setFormData] = useState({
    m365_tenant_id: "",
    m365_client_id: "",
    m365_client_secret: "",
    m365_sender_email: "",
    m365_sender_name: "",
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchConfig();
    }
  }, [currentCompany?.id]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("company_email_config")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setConfig(data);
        setFormData({
          m365_tenant_id: data.m365_tenant_id || "",
          m365_client_id: data.m365_client_id || "",
          m365_client_secret: "",
          m365_sender_email: data.m365_sender_email || "",
          m365_sender_name: data.m365_sender_name || "",
        });
      }
    } catch (error: any) {
      console.error("Error fetching email config:", error);
      toast({
        title: "Error",
        description: "Failed to load email configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentCompany?.id) return;

    if (!formData.m365_tenant_id || !formData.m365_client_id || !formData.m365_sender_email) {
      toast({
        title: "Validation Error",
        description: "Tenant ID, Client ID, and Sender Email are required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Encrypt the client secret if provided
      let encryptedSecret = null;
      if (formData.m365_client_secret) {
        const { data: encrypted, error: encryptError } = await supabase.rpc("encrypt_secret", {
          secret: formData.m365_client_secret,
        });
        if (encryptError) throw encryptError;
        encryptedSecret = encrypted;
      }

      const configData = {
        company_id: currentCompany.id,
        m365_tenant_id: formData.m365_tenant_id,
        m365_client_id: formData.m365_client_id,
        m365_sender_email: formData.m365_sender_email,
        m365_sender_name: formData.m365_sender_name,
        is_configured: true,
        configured_by: user?.id,
        configured_at: new Date().toISOString(),
        ...(encryptedSecret && { m365_client_secret_encrypted: encryptedSecret }),
      };

      const { error } = await supabase
        .from("company_email_config")
        .upsert(configData, { onConflict: "company_id" });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email configuration saved successfully",
      });

      // Clear the client secret field after saving
      setFormData(prev => ({ ...prev, m365_client_secret: "" }));
      await fetchConfig();
    } catch (error: any) {
      console.error("Error saving email config:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save email configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!currentCompany?.id) return;

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-m365-connection", {
        body: { company_id: currentCompany.id },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Connection Successful",
          description: "Microsoft 365 email configuration is working correctly",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message || "Failed to connect to Microsoft 365",
          variant: "destructive",
        });
      }

      await fetchConfig();
    } catch (error: any) {
      console.error("Error testing connection:", error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test email connection",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Microsoft 365 Email Configuration
              </CardTitle>
              <CardDescription>
                Configure email sending for {currentCompany?.name}
              </CardDescription>
            </div>
            {config?.is_configured && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {config?.last_tested_at && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Last tested</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(config.last_tested_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={config.last_test_status === "success" ? "secondary" : "destructive"}>
                  {config.last_test_status || "unknown"}
                </Badge>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant_id">Tenant ID *</Label>
              <Input
                id="tenant_id"
                value={formData.m365_tenant_id}
                onChange={(e) => setFormData({ ...formData, m365_tenant_id: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_id">Client ID *</Label>
              <Input
                id="client_id"
                value={formData.m365_client_id}
                onChange={(e) => setFormData({ ...formData, m365_client_id: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_secret">
                Client Secret {config?.m365_client_secret_encrypted ? "(leave blank to keep existing)" : "*"}
              </Label>
              <Input
                id="client_secret"
                type="password"
                value={formData.m365_client_secret}
                onChange={(e) => setFormData({ ...formData, m365_client_secret: e.target.value })}
                placeholder={config?.m365_client_secret_encrypted ? "••••••••••••••••" : "Enter client secret"}
              />
              <p className="text-xs text-muted-foreground">
                Client secret is encrypted and never displayed after saving
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender_email">Sender Email *</Label>
              <Input
                id="sender_email"
                type="email"
                value={formData.m365_sender_email}
                onChange={(e) => setFormData({ ...formData, m365_sender_email: e.target.value })}
                placeholder="notifications@yourcompany.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender_name">Sender Display Name</Label>
              <Input
                id="sender_name"
                value={formData.m365_sender_name}
                onChange={(e) => setFormData({ ...formData, m365_sender_name: e.target.value })}
                placeholder={currentCompany?.name || "Your Company"}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>

            {config?.is_configured && (
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
            )}
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Setup Instructions</h4>
            <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-decimal list-inside">
              <li>Go to Azure Portal → Azure Active Directory → App registrations</li>
              <li>Create a new registration or select existing app</li>
              <li>Note the Application (client) ID and Directory (tenant) ID</li>
              <li>Create a client secret under Certificates & secrets</li>
              <li>Add API permission: Microsoft Graph → Mail.Send</li>
              <li>Grant admin consent for the permission</li>
              <li>Enter the credentials above and test the connection</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
