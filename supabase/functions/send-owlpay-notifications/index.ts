import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Frequency = "daily" | "weekly" | "monthly";

const toFrequency = (value: string | null | undefined): Frequency => {
  if (value === "weekly" || value === "monthly") return value;
  return "daily";
};

const getNextDueAt = (lastSentAt: Date, frequency: Frequency): Date => {
  const next = new Date(lastSentAt);
  if (frequency === "daily") next.setDate(next.getDate() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
};

const getPeriodStart = (now: Date, frequency: Frequency): Date => {
  const start = new Date(now);
  if (frequency === "daily") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (frequency === "weekly") {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      company_id,
      transaction_type,
      child_id,
      staff_id,
      amount,
      new_balance,
    } = await req.json();

    if (!company_id || transaction_type !== "purchase") {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "non-purchase-or-missing-company" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { data: config, error: configError } = await supabase
      .from("owl_pay_email_config")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no-email-config" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { data: emailConfig } = await supabase
      .from("company_email_config")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    const sendEmailViaM365 = async (recipientEmail: string, subject: string, content: string) => {
      if (!emailConfig?.is_configured || emailConfig?.is_active === false || !recipientEmail) return false;

      const { data: decryptedSecret, error: decryptError } = await supabase.rpc("decrypt_secret", {
        encrypted: emailConfig.m365_client_secret_encrypted,
      });
      if (decryptError || !decryptedSecret) {
        console.error("Failed to decrypt M365 secret", decryptError);
        return false;
      }

      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${emailConfig.m365_tenant_id}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: emailConfig.m365_client_id,
            client_secret: decryptedSecret,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }),
        },
      );

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData?.access_token) {
        console.error("Failed to get Graph token", tokenData);
        return false;
      }

      const payload = {
        message: {
          subject,
          body: {
            contentType: "HTML",
            content: content.replace(/\n/g, "<br>"),
          },
          toRecipients: [{ emailAddress: { address: recipientEmail } }],
        },
      };

      const sendResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${emailConfig.m365_sender_email}/sendMail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!sendResponse.ok) {
        console.error("M365 send failed", await sendResponse.text());
        return false;
      }
      return true;
    };

    let lowBalanceSent = false;
    let staffReportSent = false;

    if (config.low_balance_alerts_enabled && child_id && typeof new_balance === "number") {
      const threshold = Number(config.low_balance_threshold ?? 5);
      if (new_balance < threshold) {
        const { data: child } = await supabase
          .from("children")
          .select("name, guardian_email")
          .eq("id", child_id)
          .maybeSingle();

        const recipientEmail = (config.low_balance_recipient_email || child?.guardian_email || "").trim();
        if (recipientEmail) {
          const camperName = child?.name || "Camper";
          const subject = `Canteen Balance Alert - ${camperName}`;
          const content = [
            `Camper: ${camperName}`,
            ``,
            `Your camper's canteen spending account balance has fallen below the $${threshold.toFixed(2)} threshold. Please log in to your CampMinder account to replenish the account.`,
            ``,
            `Please note that the balance displayed in CampMinder may not always reflect the most current amount, as CampMinder and our new canteen system do not update in real time.`,
          ].join("\n");
          lowBalanceSent = await sendEmailViaM365(recipientEmail, subject, content);
        }
      }
    }

    if (config.staff_purchase_reports_enabled && staff_id) {
      const frequency = toFrequency(config.staff_report_frequency);
      const now = new Date();
      const lastSentAt = config.last_staff_report_sent_at ? new Date(config.last_staff_report_sent_at) : null;
      const due = !lastSentAt || now >= getNextDueAt(lastSentAt, frequency);

      if (due) {
        const periodStart = lastSentAt || getPeriodStart(now, frequency);
        const { data: rows, error: rowsError } = await supabase
          .from("owl_pay_transactions")
          .select("amount, created_at, staff_id, staff(name), owl_pay_items(name)")
          .eq("company_id", company_id)
          .eq("transaction_type", "purchase")
          .not("staff_id", "is", null)
          .gte("created_at", periodStart.toISOString())
          .lte("created_at", now.toISOString());

        if (rowsError) throw rowsError;

        if (rows && rows.length > 0) {
          const recipientEmail = (config.staff_report_recipient_email || config.low_balance_recipient_email || "").trim();
          if (recipientEmail) {
            const total = rows.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
            const byStaff = new Map<string, { count: number; total: number }>();
            rows.forEach((r: any) => {
              const staffName = r.staff?.name || "Unknown";
              const current = byStaff.get(staffName) || { count: 0, total: 0 };
              byStaff.set(staffName, { count: current.count + 1, total: current.total + Number(r.amount || 0) });
            });

            const staffSummary = Array.from(byStaff.entries())
              .sort((a, b) => b[1].total - a[1].total)
              .map(([name, stats]) => `- ${name}: ${stats.count} purchases, $${stats.total.toFixed(2)}`)
              .join("\n");

            const subject = `Owl Pay Staff Purchase Report (${frequency})`;
            const content = [
              `Staff purchase summary for ${frequency} reporting window.`,
              ``,
              `Period Start: ${periodStart.toLocaleString()}`,
              `Period End: ${now.toLocaleString()}`,
              `Total Purchases: ${rows.length}`,
              `Total Amount: $${total.toFixed(2)}`,
              ``,
              `By Staff:`,
              staffSummary,
            ].join("\n");

            staffReportSent = await sendEmailViaM365(recipientEmail, subject, content);
          }
        }

        await supabase
          .from("owl_pay_email_config")
          .update({ last_staff_report_sent_at: now.toISOString(), updated_at: now.toISOString() })
          .eq("company_id", company_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        low_balance_sent: lowBalanceSent,
        staff_report_sent: staffReportSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("Error in send-owlpay-notifications:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
