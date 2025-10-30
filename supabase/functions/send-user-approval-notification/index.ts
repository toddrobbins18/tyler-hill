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

    const { user_id, user_email, user_name } = await req.json();
    console.log(`Processing user approval notification for: ${user_email}`);

    // Get recipients based on configuration
    const recipients = await getRecipientsForEmailType(supabase, 'user_approval_request');

    if (!recipients.length) {
      console.log('No recipients configured for user approval requests');
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Create notification content
    const subject = `New User Approval Request: ${user_name || user_email}`;
    const content = `
A new user has registered and is awaiting approval:

**Name:** ${user_name || 'Not provided'}
**Email:** ${user_email}
**Requested:** ${new Date().toLocaleString()}

Please review and approve this user in the Admin Panel > User Management section.
    `.trim();

    // Send notifications
    await sendEmailNotifications(supabase, recipients, subject, content);

    // Log notification
    await supabase.from('notification_logs').insert({
      event_type: 'user_approval_request',
      recipient_count: recipients.length,
      notification_version: 1,
    });

    console.log(`Successfully sent user approval notifications to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients_notified: recipients.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-user-approval-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
