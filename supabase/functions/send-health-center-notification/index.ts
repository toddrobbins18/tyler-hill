import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailType, sendEmailNotifications } from "../_shared/emailHelpers.ts";
import { formatEasternDateTime } from "../_shared/dailyDashboardFormat.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function profileNameForUserId(
  supabase: ReturnType<typeof createClient>,
  userId: string | null | undefined,
): Promise<string> {
  if (!userId) return "N/A";
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return profile?.full_name?.trim() || "N/A";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { admission_id, event_type } = await req.json();
    console.log(`Processing health center notification: ${admission_id}, type: ${event_type}`);

    // Explicit FK on children — table has two child_id foreign keys.
    // admitted_by/checked_out_by reference auth.users, not profiles; resolve names separately.
    const { data: admission, error: admissionError } = await supabase
      .from('health_center_admissions')
      .select(`
        *,
        child:children!fk_health_center_admissions_child_id (
          id,
          name,
          division:divisions (
            name
          )
        ),
        staff:staff!health_center_admissions_staff_id_fkey (
          id,
          name
        )
      `)
      .eq('id', admission_id)
      .single();

    if (admissionError) {
      console.error('Error fetching admission:', admissionError);
      throw admissionError;
    }

    const [admittedByName, checkedOutByName] = await Promise.all([
      profileNameForUserId(supabase, admission.admitted_by),
      profileNameForUserId(supabase, admission.checked_out_by),
    ]);

    const emailType = event_type === 'checkout' ? 'health_center_checkout' : 'health_center_admission';
    const recipients = await getRecipientsForEmailType(supabase, emailType, admission.company_id);

    if (!recipients.length) {
      console.log(`No recipients configured for ${emailType}`);
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const personName = admission.child?.name || admission.staff?.name || 'Unknown';
    const divisionName = admission.child?.division?.name || (admission.staff ? 'Staff' : 'N/A');
    const personLabel = admission.staff ? 'Staff Member' : 'Child';
    const isCheckout = event_type === 'checkout';
    const subject = isCheckout
      ? `Health Center: ${personName} Checked Out`
      : `Health Center: ${personName} Admitted`;

    const content = isCheckout ? `
**${personLabel}:** ${personName}
**Division:** ${divisionName}

**Checked Out:** ${formatEasternDateTime(admission.checked_out_at)}
**Checked Out By:** ${checkedOutByName}

**Original Admission:**
- **Admitted:** ${formatEasternDateTime(admission.admitted_at)}
- **Reason:** ${admission.reason || 'N/A'}

${admission.notes ? `**Notes:** ${admission.notes}` : ''}
    `.trim() : `
**${personLabel}:** ${personName}
**Division:** ${divisionName}

**Admitted:** ${formatEasternDateTime(admission.admitted_at)}
**Admitted By:** ${admittedByName}

**Reason:** ${admission.reason || 'N/A'}

${admission.notes ? `**Notes:** ${admission.notes}` : ''}
    `.trim();

    await sendEmailNotifications(supabase, recipients, subject, content, admission.company_id);

    const { error: logError } = await supabase.from('notification_logs').insert({
      event_type: emailType,
      event_id: admission_id,
      recipient_count: recipients.length,
      notification_version: 1,
    });
    if (logError) {
      console.warn('Could not write notification_logs (non-fatal):', logError);
    }

    console.log(`Successfully sent health center notifications to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        recipients_notified: recipients.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-health-center-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
