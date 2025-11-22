import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailTypeWithFilters, sendEmailNotifications } from "../_shared/emailHelpers.ts";

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

    const { enrollment_id, action } = await req.json();
    console.log(`Sports academy notification triggered: ${action} for enrollment ${enrollment_id}`);

    // Fetch enrollment with child and division info
    const { data: enrollment, error } = await supabase
      .from('sports_academy')
      .select(`
        *,
        children!inner(
          id, 
          name, 
          division_id,
          divisions(id, name)
        )
      `)
      .eq('id', enrollment_id)
      .single();

    if (error) {
      console.error('Error fetching sports academy enrollment:', error);
      throw error;
    }

    // Get division IDs and sport type for filtering
    const divisionIds = enrollment.children?.division_id 
      ? [enrollment.children.division_id] 
      : [];
    
    const sportType = enrollment.sport_name;

    console.log(`Enrollment for ${enrollment.children?.name}, Division: ${enrollment.children?.divisions?.name}, Sport: ${sportType}`);

    // Get recipients with BOTH division and sport filtering
    const recipients = await getRecipientsForEmailTypeWithFilters(
      supabase,
      'sports_academy',
      enrollment.company_id,
      { divisionIds, sportType }
    );

    if (!recipients.length) {
      console.log('No recipients configured for sports_academy notifications');
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Build email content
    const actionText = action === 'INSERT' ? 'New' : 'Updated';
    const subject = `${actionText} Sports Academy Enrollment: ${sportType} - ${enrollment.children?.name}`;
    const content = `
      <h2>${subject}</h2>
      <p><strong>Camper:</strong> ${enrollment.children?.name}</p>
      <p><strong>Division:</strong> ${enrollment.children?.divisions?.name || 'N/A'}</p>
      <p><strong>Sport:</strong> ${sportType}</p>
      ${enrollment.instructor ? `<p><strong>Instructor:</strong> ${enrollment.instructor}</p>` : ''}
      ${enrollment.schedule_periods?.length ? `<p><strong>Schedule:</strong> ${enrollment.schedule_periods.join(', ')}</p>` : ''}
      ${enrollment.start_date ? `<p><strong>Start Date:</strong> ${enrollment.start_date}</p>` : ''}
      ${enrollment.end_date ? `<p><strong>End Date:</strong> ${enrollment.end_date}</p>` : ''}
      ${enrollment.notes ? `<p><strong>Notes:</strong> ${enrollment.notes}</p>` : ''}
      <p><em>This notification was sent to ${recipients.length} staff member(s) in the ${sportType} program and relevant division leaders.</em></p>
    `;

    // Send notifications
    await sendEmailNotifications(supabase, recipients, subject, content, enrollment.company_id);

    // Log notification
    await supabase.from('notification_logs').insert({
      event_type: 'sports_academy',
      event_id: enrollment_id,
      recipient_count: recipients.length
    });

    console.log(`✅ Sent sports academy notification to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipients.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-sports-academy-notification:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
