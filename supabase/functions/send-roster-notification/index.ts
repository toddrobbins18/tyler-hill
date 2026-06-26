import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailNotifications } from "../_shared/emailHelpers.ts";

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

    const { eventId, companyId, eventTitle, rosterCount, action } = await req.json();
    console.log(`Processing roster notification: ${eventId}, action: ${action}`);

    // Fetch Health Center users
    const { data: hcRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'health_center')
      .eq('company_id', companyId);

    // Fetch Food Service users
    const { data: foodTags } = await supabase
      .from('user_tags')
      .select('user_id')
      .eq('tag', 'food_service')
      .eq('company_id', companyId);

    const userIds = new Set([
      ...(hcRoles?.map((r: any) => r.user_id) || []),
      ...(foodTags?.map((t: any) => t.user_id) || [])
    ]);

    if (userIds.size === 0) {
      console.log('No health center or food service users found');
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', Array.from(userIds))
      .eq('company_id', companyId);

    const recipients = profiles || [];

    if (!recipients.length) {
      return new Response(
        JSON.stringify({ message: 'No valid recipient profiles found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Create notification content
    const subject = `Roster Submitted: ${eventTitle}`;
    const content = `
A roster for the event "${eventTitle}" has been ${action}.

**Event Title:** ${eventTitle}
**Total Campers on Roster:** ${rosterCount}

Please review the event details in the Sports Calendar or Roster section to prepare any necessary medications or meals.
    `.trim();

    // Send notifications
    await sendEmailNotifications(supabase, recipients, subject, content, companyId);

    console.log(`Successfully sent roster notifications to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients_notified: recipients.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-roster-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});