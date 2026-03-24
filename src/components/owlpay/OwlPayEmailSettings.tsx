import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Mail, AlertTriangle, FileText, Save } from "lucide-react";

interface EmailConfig {
  id?: string;
  low_balance_alerts_enabled: boolean;
  low_balance_threshold: number;
  low_balance_recipient_email: string;
  staff_purchase_reports_enabled: boolean;
  staff_report_frequency: string;
  staff_report_recipient_email: string;
}

const defaultConfig: EmailConfig = {
  low_balance_alerts_enabled: false,
  low_balance_threshold: 5,
  low_balance_recipient_email: "",
  staff_purchase_reports_enabled: false,
  staff_report_frequency: "daily",
  staff_report_recipient_email: "",
};

const OwlPayEmailSettings = () => {
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, [currentCompany]);

  const loadConfig = async () => {
    if (!currentCompany?.id) return;
    const { data, error } = await supabase
      .from("owl_pay_email_config" as any)
      .select("*")
      .eq("company_id", currentCompany.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    if (data) {
      const d = data as any;
      setConfig({
        id: d.id,
        low_balance_alerts_enabled: d.low_balance_alerts_enabled,
        low_balance_threshold: Number(d.low_balance_threshold),
        low_balance_recipient_email: d.low_balance_recipient_email || "",
        staff_purchase_reports_enabled: d.staff_purchase_reports_enabled,
        staff_report_frequency: d.staff_report_frequency,
        staff_report_recipient_email: d.staff_report_recipient_email || "",
      });
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    if (!currentCompany?.id) return;
    setSaving(true);

    const payload = {
      company_id: currentCompany.id,
      low_balance_alerts_enabled: config.low_balance_alerts_enabled,
      low_balance_threshold: config.low_balance_threshold,
      low_balance_recipient_email: config.low_balance_recipient_email || null,
      staff_purchase_reports_enabled: config.staff_purchase_reports_enabled,
      staff_report_frequency: config.staff_report_frequency,
      staff_report_recipient_email: config.staff_report_recipient_email || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (config.id) {
      ({ error } = await supabase
        .from("owl_pay_email_config" as any)
        .update(payload)
        .eq("id", config.id));
    } else {
      ({ error } = await supabase
        .from("owl_pay_email_config" as any)
        .insert(payload));
    }

    if (error) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Settings saved", description: "Owl Pay email settings updated." });
      loadConfig();
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">Loading settings...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Low Balance Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Low Balance Alerts</CardTitle>
              <CardDescription>Send an email when a camper's balance drops below a threshold after a purchase.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="low-balance-toggle" className="font-medium">Enable Low Balance Alerts</Label>
            <Switch
              id="low-balance-toggle"
              checked={config.low_balance_alerts_enabled}
              onCheckedChange={(v) => setConfig({ ...config, low_balance_alerts_enabled: v })}
            />
          </div>

          {config.low_balance_alerts_enabled && (
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Balance Threshold ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={config.low_balance_threshold}
                  onChange={(e) => setConfig({ ...config, low_balance_threshold: Number(e.target.value) })}
                  className="max-w-[200px]"
                />
                <p className="text-xs text-muted-foreground">Alert triggers when balance falls below this amount.</p>
              </div>
              <div className="space-y-2">
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  placeholder="admin@camp.com"
                  value={config.low_balance_recipient_email}
                  onChange={(e) => setConfig({ ...config, low_balance_recipient_email: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave blank to send to the camper's guardian email on file.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Purchase Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Staff Purchase Reports</CardTitle>
              <CardDescription>Send periodic reports summarizing staff purchases to an administrator.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="staff-report-toggle" className="font-medium">Enable Staff Reports</Label>
            <Switch
              id="staff-report-toggle"
              checked={config.staff_purchase_reports_enabled}
              onCheckedChange={(v) => setConfig({ ...config, staff_purchase_reports_enabled: v })}
            />
          </div>

          {config.staff_purchase_reports_enabled && (
            <div className="space-y-4 pt-2 border-t">
              <div className="space-y-2">
                <Label>Report Frequency</Label>
                <Select
                  value={config.staff_report_frequency}
                  onValueChange={(v) => setConfig({ ...config, staff_report_frequency: v })}
                >
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  placeholder="director@camp.com"
                  value={config.staff_report_recipient_email}
                  onChange={(e) => setConfig({ ...config, staff_report_recipient_email: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Who should receive the staff purchase summary.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={saveConfig} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Badge variant="outline" className="text-xs">
          <Mail className="h-3 w-3 mr-1" />
          Emails sent via camp's configured email system
        </Badge>
      </div>
    </div>
  );
};

export default OwlPayEmailSettings;
