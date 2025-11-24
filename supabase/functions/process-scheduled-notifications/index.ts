import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailTypeWithFilters, sendEmailNotifications } from "../_shared/emailHelpers.ts";
import { buildTimingSubject, addTimingContext } from "../_shared/timingHelpers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing scheduled notifications...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find notifications due to be sent (up to 100 at a time)
    const { data: pending, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('sent', false)
      .lte('send_at', new Date().toISOString())
      .limit(100);

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError);
      throw fetchError;
    }

    if (!pending || pending.length === 0) {
      console.log('No pending notifications to process');
      return new Response(
        JSON.stringify({ message: 'No pending notifications', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${pending.length} pending notifications`);
    let successCount = 0;
    let errorCount = 0;

    for (const notification of pending) {
      try {
        console.log(`Processing notification ${notification.id} for ${notification.email_type}`);

        // Parse event data from stored JSON
        const eventData = notification.event_data || {};
        
        // Get recipients based on email type and filters
        const recipients = await getRecipientsForEmailTypeWithFilters(
          supabase,
          notification.email_type,
          notification.company_id,
          {
            divisionIds: eventData.divisionIds,
            sportType: eventData.sportType
          }
        );

        if (!recipients.length) {
          console.log(`No recipients for notification ${notification.id}`);
          await supabase
            .from('scheduled_notifications')
            .update({
              sent: true,
              sent_at: new Date().toISOString(),
              recipient_count: 0,
              error_message: 'No recipients configured'
            })
            .eq('id', notification.id);
          continue;
        }

        // Build subject with timing context
        const subject = buildTimingSubject(
          eventData.title || 'Event',
          notification.timing_type
        );

        // Build content with timing prefix
        let content = eventData.content || 'Event details not available';
        content = addTimingContext(content, notification.timing_type);

        // Send the notifications
        await sendEmailNotifications(
          supabase,
          recipients,
          subject,
          content,
          notification.company_id
        );

        // Mark as sent
        await supabase
          .from('scheduled_notifications')
          .update({
            sent: true,
            sent_at: new Date().toISOString(),
            recipient_count: recipients.length
          })
          .eq('id', notification.id);

        console.log(`Successfully sent notification ${notification.id} to ${recipients.length} recipients`);
        successCount++;

      } catch (error: any) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Log error but continue processing others
        await supabase
          .from('scheduled_notifications')
          .update({
            error_message: error.message
          })
          .eq('id', notification.id);
        
        errorCount++;
      }
    }

    console.log(`Processed ${successCount} notifications successfully, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: successCount,
        errors: errorCount,
        total: pending.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in process-scheduled-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
