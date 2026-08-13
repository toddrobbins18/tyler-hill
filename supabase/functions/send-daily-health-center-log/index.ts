import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailType, sendEmailNotifications } from "../_shared/emailHelpers.ts";
import {
  easternSeasonYear,
  easternTodayYMD,
  escapeHtml,
  formatBulletinDisplayDate,
  formatEasternDateTime,
} from "../_shared/dailyDashboardFormat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_TYPE = "health_center_overnight_log";

type AdmissionRow = {
  id: string;
  admitted_at: string;
  reason: string | null;
  notes: string | null;
  child: {
    name: string;
    division: { name: string } | null;
  } | null;
  staff: {
    name: string;
  } | null;
};

function personLabel(admission: AdmissionRow): string {
  if (admission.staff?.name) return admission.staff.name;
  if (admission.child?.name) return admission.child.name;
  return "Unknown";
}

function divisionLabel(admission: AdmissionRow): string {
  if (admission.staff?.name) return "Staff";
  return admission.child?.division?.name || "N/A";
}

function buildOvernightLogHtml(companyName: string, dateYMD: string, admissions: AdmissionRow[]): string {
  const displayDate = formatBulletinDisplayDate(dateYMD);

  if (!admissions.length) {
    return `
      <h2>Health Center Overnight Log</h2>
      <p><strong>${escapeHtml(companyName)}</strong> &mdash; ${escapeHtml(displayDate)}</p>
      <p>No campers or staff are currently staying overnight in the Health Center.</p>
    `.trim();
  }

  const rows = admissions.map((admission) => {
    const reason = admission.reason?.trim() || "N/A";
    const notes = admission.notes?.trim() || "—";
    return `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(personLabel(admission))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(divisionLabel(admission))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(formatEasternDateTime(admission.admitted_at))}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(reason)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(notes)}</td>
      </tr>
    `.trim();
  }).join("");

  return `
    <h2>Health Center Overnight Log</h2>
    <p><strong>${escapeHtml(companyName)}</strong> &mdash; ${escapeHtml(displayDate)}</p>
    <p>The following ${admissions.length} ${admissions.length === 1 ? "person is" : "people are"} still in the Health Center this morning:</p>
    <table style="border-collapse:collapse;width:100%;max-width:900px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Name</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Division</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Checked In</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Reason</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left;">Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `.trim();
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

    console.log("Sending daily health center overnight logs...");

    const todayYMD = easternTodayYMD();
    const season = easternSeasonYear();

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, slug")
      .eq("is_active", true);

    if (companiesError) throw companiesError;

    let emailsSent = 0;

    for (const company of companies || []) {
      // Tyler Hill closed — Daily News only (see enable_tyler_hill_daily_news_only.sql)
      if (company.slug === "tyler-hill-camp") continue;

      const recipients = await getRecipientsForEmailType(supabase, EMAIL_TYPE, company.id);
      if (!recipients.length) {
        console.log(`No recipients configured for ${EMAIL_TYPE} in ${company.name}`);
        continue;
      }

      const { data: admissions, error: admissionsError } = await supabase
        .from("health_center_admissions")
        .select(`
          id,
          admitted_at,
          reason,
          notes,
          child:children!fk_health_center_admissions_child_id (
            name,
            division:divisions (
              name
            )
          ),
          staff:staff!health_center_admissions_staff_id_fkey (
            name
          )
        `)
        .eq("company_id", company.id)
        .eq("season", season)
        .is("checked_out_at", null)
        .order("admitted_at", { ascending: true });

      if (admissionsError) {
        console.error(`Error fetching admissions for ${company.name}:`, admissionsError);
        continue;
      }

      const subject = `Health Center Overnight Log - ${todayYMD}`;
      const content = buildOvernightLogHtml(
        company.name,
        todayYMD,
        (admissions || []) as AdmissionRow[],
      );

      console.log(
        `Sending ${subject} to ${recipients.length} recipients in ${company.name} (${admissions?.length || 0} overnight stays)`,
      );

      try {
        await sendEmailNotifications(supabase, recipients, subject, content, company.id);
        emailsSent += recipients.length;
      } catch (companyError: unknown) {
        console.error(`Failed sending overnight log for ${company.name}:`, companyError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error in send-daily-health-center-log:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
