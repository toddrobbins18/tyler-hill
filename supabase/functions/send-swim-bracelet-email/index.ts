import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  braceletFromJson,
  buildSwimBraceletEmail,
  guessDivisionLeaderEmail,
} from "../_shared/swimBraceletEmail.ts";
import { trySendM365Email } from "../_shared/m365SendMail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function resolveDivisionLeaderEmail(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  season: string,
  leaderName: string,
): Promise<string | null> {
  const normalized = leaderName.trim();
  if (!normalized || normalized === "—") return null;

  const { data: staffRows } = await supabase
    .from("staff")
    .select("name, email")
    .eq("company_id", companyId)
    .eq("season", season)
    .neq("status", "inactive");

  for (const row of staffRows ?? []) {
    const name = String(row.name ?? "").trim();
    const email = String(row.email ?? "").trim();
    if (!email || !name) continue;
    if (name.toLowerCase() === normalized.toLowerCase()) return email;
    if (name.toLowerCase().startsWith(normalized.toLowerCase().split(/\s+/)[0] ?? "")) return email;
  }

  return guessDivisionLeaderEmail(normalized);
}

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

    const { company_id, child_id, season, preview } = await req.json();
    const forcePreview = preview === true;

    if (!company_id || !child_id || !season) {
      throw new Error("company_id, child_id, and season are required");
    }

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = userRoles?.map((r) => r.role) ?? [];
    const hasPermission = roles.some((r) =>
      ["admin", "super_admin", "staff", "health_center", "division_leader"].includes(r)
    );
    if (!hasPermission) throw new Error("Insufficient permissions");

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("company_id, companies!inner(name)")
      .eq("id", user.id)
      .single();
    if (!senderProfile?.company_id || senderProfile.company_id !== company_id) {
      throw new Error("Company mismatch");
    }

    const { data: child } = await supabase
      .from("children")
      .select("id, name, season")
      .eq("id", child_id)
      .eq("company_id", company_id)
      .single();
    if (!child) throw new Error("Camper not found");
    if (String(child.season ?? "") !== String(season)) throw new Error("Camper season mismatch");

    const { data: swimRow } = await supabase
      .from("swim_program_records")
      .select("bracelet")
      .eq("company_id", company_id)
      .eq("season", season)
      .eq("child_id", child_id)
      .maybeSingle();

    if (!swimRow?.bracelet || typeof swimRow.bracelet !== "object") {
      throw new Error("No swim bracelet data saved for this camper");
    }

    const bracelet = braceletFromJson(child.name?.trim() || "Camper", swimRow.bracelet as Record<string, unknown>);
    const rendered = buildSwimBraceletEmail(bracelet);
    const recipient = await resolveDivisionLeaderEmail(supabase, company_id, season, bracelet.divisionLeader);
    if (!recipient) {
      throw new Error("No email for division leader — assign a leader on the bracelet row or add staff email");
    }

    const campName = (senderProfile.companies as { name?: string } | null)?.name ?? "Camp";

    if (forcePreview) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          sent: false,
          recipient,
          subject: rendered.subject,
          html: rendered.html,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const m365 = await trySendM365Email(supabase, company_id, {
      subject: rendered.subject,
      html: rendered.html,
      to: recipient,
      fromName: campName,
    });

    if (!m365.configured) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          sent: false,
          recipient,
          subject: rendered.subject,
          html: rendered.html,
          message: "M365 not configured — email preview only. Configure Admin → Email to send live.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (!m365.sent) {
      throw new Error(m365.error ?? "Failed to send email");
    }

    const braceletPatch = {
      ...(swimRow.bracelet as Record<string, unknown>),
      emailSent: true,
    };
    await supabase
      .from("swim_program_records")
      .update({ bracelet: braceletPatch })
      .eq("company_id", company_id)
      .eq("season", season)
      .eq("child_id", child_id);

    await supabase.from("email_logs").insert({
      sent_by: user.id,
      subject: rendered.subject,
      recipient_count: 1,
      recipient_ids: [child_id],
      recipient_tags: ["swim_bracelet:division_leader"],
      status: "sent",
      delivery_methods: { email: true, inApp: false },
    });

    return new Response(
      JSON.stringify({
        success: true,
        preview: false,
        sent: true,
        recipient,
        subject: rendered.subject,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-swim-bracelet-email error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
