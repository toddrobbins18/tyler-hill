import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isParentEmailTemplateKey,
  renderParentEmailTemplate,
} from "../_shared/parentEmailTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { company_id, child_id, template_key } = await req.json();
    if (!company_id || !child_id || !template_key) {
      throw new Error("company_id, child_id, and template_key are required");
    }
    if (!isParentEmailTemplateKey(template_key)) {
      throw new Error("Invalid template_key");
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

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("company_id, full_name, companies!inner(name)")
      .eq("id", user.id)
      .single();

    if (!senderProfile?.company_id || senderProfile.company_id !== company_id) {
      throw new Error("Company mismatch");
    }

    const { data: child, error: childError } = await supabase
      .from("children")
      .select("id, name, guardian_email, company_id")
      .eq("id", child_id)
      .eq("company_id", company_id)
      .single();

    if (childError || !child) throw new Error("Camper not found");

    const parentEmail = child.guardian_email?.trim();
    if (!parentEmail) {
      throw new Error("No parent email on file for this camper");
    }

    const campName = (senderProfile.companies as { name?: string } | null)?.name ?? "Camp";
    const rendered = renderParentEmailTemplate(template_key, {
      camperName: child.name?.trim() || "your camper",
      campName,
    });
    if (!rendered) throw new Error("Template not found");

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

    const htmlBody = rendered.body
      .split("\n")
      .map((line) => line.trim())
      .join("<br>");

    const sendResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${emailConfig.m365_sender_email}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: rendered.subject,
            body: { contentType: "HTML", content: htmlBody },
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
      console.error("M365 send failed", detail);
      throw new Error("Failed to send email");
    }

    await supabase.from("email_logs").insert({
      sent_by: user.id,
      subject: rendered.subject,
      recipient_count: 1,
      recipient_ids: [child_id],
      recipient_tags: [`parent_template:${template_key}`],
      status: "sent",
      delivery_methods: { email: true, inApp: false },
    });

    return new Response(
      JSON.stringify({
        success: true,
        recipient: parentEmail,
        subject: rendered.subject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-parent-template-email error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
