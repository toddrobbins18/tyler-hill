import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSunshineReportEmail } from "../_shared/sunshineReportEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SendResult =
  | { camper_id: string; status: "sent"; recipient: string; subject: string }
  | { camper_id: string; status: "skipped"; reason: string }
  | { camper_id: string; status: "failed"; error: string };

type PreviewResult =
  | {
      camper_id: string;
      camper_name: string;
      recipient: string | null;
      subject: string;
      html: string;
      imageBase64: string;
      renderedImage: boolean;
      status: "ok";
    }
  | { camper_id: string; status: "failed"; error: string };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { company_id, report_date, camper_ids, preview } = await req.json();
    const isPreview = preview === true;

    if (!company_id || !report_date) {
      throw new Error("company_id and report_date are required");
    }
    if (!Array.isArray(camper_ids) || camper_ids.length === 0) {
      throw new Error("camper_ids must be a non-empty array");
    }

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = userRoles?.map((r) => r.role) ?? [];
    const hasPermission = roles.some((r) =>
      ["admin", "super_admin", "staff", "health_center", "division_leader"].includes(r)
    );
    if (!hasPermission) {
      throw new Error("Insufficient permissions");
    }

    const { data: canManage, error: accessError } = await supabase.rpc(
      "user_can_manage_sunshine_data",
      { _user_id: user.id, _company_id: company_id },
    );
    if (accessError || !canManage) {
      throw new Error("Company mismatch");
    }

    const { data: companyRow } = await supabase
      .from("companies")
      .select("name")
      .eq("id", company_id)
      .maybeSingle();
    const campName = companyRow?.name ?? "Camp";

    if (isPreview) {
      const previews: PreviewResult[] = [];
      for (const camperId of camper_ids as string[]) {
        const built = await buildCamperSunshineEmail(supabase, {
          company_id,
          report_date,
          camperId,
          campName,
        });
        previews.push(built);
      }
      return new Response(
        JSON.stringify({ success: true, preview: true, previews }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const { data: emailConfig } = await supabase
      .from("company_email_config")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (!emailConfig?.is_configured || emailConfig?.is_active === false) {
      throw new Error("Camp email is not configured. Set up Microsoft 365 in Admin → Email Config.");
    }

    const { data: decryptedSecret, error: decryptError } = await supabase.rpc("decrypt_secret", {
      encrypted: emailConfig.m365_client_secret_encrypted,
    });
    if (decryptError || !decryptedSecret) {
      throw new Error("Failed to decrypt email credentials");
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
      throw new Error("Failed to authenticate with Microsoft 365");
    }

    const accessToken = tokenData.access_token as string;
    const results: SendResult[] = [];
    let sentCount = 0;

    for (const camperId of camper_ids as string[]) {
      try {
        const built = await buildCamperSunshineEmail(supabase, {
          company_id,
          report_date,
          camperId,
          campName,
        });
        if (built.status === "failed") {
          results.push({ camper_id: camperId, status: "failed", error: built.error });
          continue;
        }

        const parentEmail = built.recipient?.trim();
        if (!parentEmail) {
          results.push({ camper_id: camperId, status: "skipped", reason: "No parent email on file" });
          continue;
        }

        const { data: report } = await supabase
          .from("sunshine_reports")
          .select("send_email, email_sent_at")
          .eq("company_id", company_id)
          .eq("camper_id", camperId)
          .eq("report_date", report_date)
          .maybeSingle();

        if (report?.send_email === false) {
          results.push({ camper_id: camperId, status: "skipped", reason: "Send email disabled" });
          continue;
        }

        if (report?.email_sent_at) {
          results.push({ camper_id: camperId, status: "skipped", reason: "Already sent" });
          continue;
        }

        const sendResponse = await fetch(
          `https://graph.microsoft.com/v1.0/users/${emailConfig.m365_sender_email}/sendMail`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                subject: built.subject,
                body: { contentType: "HTML", content: built.html },
                from: {
                  emailAddress: {
                    address: emailConfig.m365_sender_email,
                    name: emailConfig.m365_sender_name || campName,
                  },
                },
                toRecipients: [{ emailAddress: { address: parentEmail } }],
              },
            }),
          },
        );

        if (!sendResponse.ok) {
          const detail = await sendResponse.text();
          console.error("M365 send failed", camperId, detail);
          results.push({ camper_id: camperId, status: "failed", error: "Failed to send email" });
          continue;
        }

        const sentAt = new Date().toISOString();
        const { error: updateError } = await supabase
          .from("sunshine_reports")
          .update({ email_sent_at: sentAt })
          .eq("company_id", company_id)
          .eq("camper_id", camperId)
          .eq("report_date", report_date);

        if (updateError) {
          console.error("email_sent_at update failed", camperId, updateError.message);
        }

        sentCount += 1;
        results.push({
          camper_id: camperId,
          status: "sent",
          recipient: parentEmail,
          subject: built.subject,
        });
      } catch (inner) {
        const message = inner instanceof Error ? inner.message : "Unknown error";
        results.push({ camper_id: camperId, status: "failed", error: message });
      }
    }

    if (sentCount > 0) {
      await supabase.from("email_logs").insert({
        sent_by: user.id,
        subject: `${campName} Sunshine Report — ${report_date}`,
        recipient_count: sentCount,
        recipient_ids: camper_ids,
        recipient_tags: ["sunshine_report"],
        status: "sent",
        delivery_methods: { email: true, inApp: false },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-sunshine-reports error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});

async function buildCamperSunshineEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    company_id: string;
    report_date: string;
    camperId: string;
    campName: string;
  },
): Promise<PreviewResult> {
  const { company_id, report_date, camperId, campName } = params;

  const { data: camper, error: camperError } = await supabase
    .from("sunshine_campers")
    .select("id, full_name, parent_email, company_id, group_id, sunshine_groups(name)")
    .eq("id", camperId)
    .eq("company_id", company_id)
    .maybeSingle();

  if (camperError || !camper) {
    return { camper_id: camperId, status: "failed", error: "Camper not found" };
  }

  const { data: report, error: reportError } = await supabase
    .from("sunshine_reports")
    .select("*")
    .eq("company_id", company_id)
    .eq("camper_id", camperId)
    .eq("report_date", report_date)
    .maybeSingle();

  if (reportError || !report) {
    return { camper_id: camperId, status: "failed", error: "No report for this date" };
  }

  const rendered = await buildSunshineReportEmail({
    camperName: camper.full_name?.trim() || "Your camper",
    campName,
    reportDate: report_date,
    sports: Array.isArray(report.sports) ? report.sports : [],
    activities: Array.isArray(report.activities) ? report.activities : [],
    lunch: Array.isArray(report.lunch) ? report.lunch : [],
    bm: report.bm === true,
    napped: report.napped === true,
  });

  return {
    camper_id: camperId,
    camper_name: camper.full_name?.trim() || "Camper",
    recipient: camper.parent_email?.trim() || null,
    subject: rendered.subject,
    html: rendered.html,
    imageBase64: rendered.imageBase64,
    renderedImage: rendered.renderedImage,
    status: "ok",
  };
}
