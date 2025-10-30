import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailType, sendEmailNotifications } from "../_shared/emailHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get admission details
    const { data: admission, error: admissionError } = await supabase
      .from('health_center_admissions')
      .select(`
        *,
        child:children (
          id,
          name,
          division:divisions (
            name
          )
        ),
        admitted_by_staff:profiles!health_center_admissions_admitted_by_fkey (
          full_name
        ),
        checked_out_by_staff:profiles!health_center_admissions_checked_out_by_fkey (
          full_name
        )
      `)
      .eq('id', admission_id)
      .single();

    if (admissionError) {
      console.error('Error fetching admission:', admissionError);
      throw admissionError;
    }

    // Determine email type based on event
    const emailType = event_type === 'checkout' ? 'health_center_checkout' : 'health_center_admission';
    
    // Get recipients based on configuration
    const recipients = await getRecipientsForEmailType(supabase, emailType);

    if (!recipients.length) {
      console.log(`No recipients configured for ${emailType}`);
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Create notification content
    const isCheckout = event_type === 'checkout';
    const subject = isCheckout 
      ? `Health Center: ${admission.child?.name} Checked Out`
      : `Health Center: ${admission.child?.name} Admitted`;

    const content = isCheckout ? `
**Child:** ${admission.child?.name}
**Division:** ${admission.child?.division?.name || 'N/A'}

**Checked Out:** ${new Date(admission.checked_out_at).toLocaleString()}
**Checked Out By:** ${admission.checked_out_by_staff?.full_name || 'N/A'}

**Original Admission:**
- **Admitted:** ${new Date(admission.admitted_at).toLocaleString()}
- **Reason:** ${admission.reason || 'N/A'}

${admission.notes ? `**Notes:** ${admission.notes}` : ''}
    `.trim() : `
**Child:** ${admission.child?.name}
**Division:** ${admission.child?.division?.name || 'N/A'}

**Admitted:** ${new Date(admission.admitted_at).toLocaleString()}
**Admitted By:** ${admission.admitted_by_staff?.full_name || 'N/A'}

**Reason:** ${admission.reason || 'N/A'}

${admission.notes ? `**Notes:** ${admission.notes}` : ''}
    `.trim();

    // Send notifications
    await sendEmailNotifications(supabase, recipients, subject, content);

    // Log notification
    await supabase.from('notification_logs').insert({
      event_type: emailType,
      event_id: admission_id,
      recipient_count: recipients.length,
      notification_version: 1,
    });

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
