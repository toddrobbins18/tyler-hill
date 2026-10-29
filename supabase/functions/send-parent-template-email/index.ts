import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isParentEmailTemplateKey } from "../_shared/parentEmailTemplates.ts";
import { buildParentReminderEmail } from "../_shared/parentReminderEmail.ts";
import { trySendM365Email } from "../_shared/m365SendMail.ts";

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

    const { company_id, child_id, template_key, preview_only, image_base64 } = await req.json();
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
    const built = buildParentReminderEmail({
      templateKey: template_key,
      camperName: child.name?.trim() || "your camper",
      campName,
    });

    if (preview_only === true) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          recipient: parentEmail,
          subject: built.subject,
          html: built.html,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const composedBytes =
      typeof image_base64 === "string"
        ? image_base64.replace(/^data:image\/\w+;base64,/, "").trim()
        : "";

    const attachments =
      composedBytes.length > 0
        ? [
            {
              name: built.attachmentName,
              contentType: "image/jpeg",
              contentBytes: composedBytes,
            },
          ]
        : undefined;

    const sendOutcome = await trySendM365Email(supabase, company_id, {
      subject: built.subject,
      html: built.html,
      to: parentEmail,
      fromName: campName,
      attachments,
    });

    if (!sendOutcome.configured) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: false,
          preview: true,
          recipient: parentEmail,
          subject: built.subject,
          message: "Camp email is not configured. Set up Microsoft 365 in Admin → Email Config.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (!sendOutcome.sent) {
      throw new Error(sendOutcome.error ?? "Failed to send email");
    }

    await supabase.from("email_logs").insert({
      sent_by: user.id,
      subject: built.subject,
      recipient_count: 1,
      recipient_ids: [child_id],
      recipient_tags: [`parent_template:${template_key}`],
      status: "sent",
      delivery_methods: { email: true, inApp: false },
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        recipient: parentEmail,
        subject: built.subject,
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
