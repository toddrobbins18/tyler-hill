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

    const { type, record } = await req.json();
    console.log(`Processing transportation event: ${type}`);

    // Get recipients based on configuration
    const recipients = await getRecipientsForEmailType(supabase, 'transportation_event');

    if (!recipients.length) {
      console.log('No recipients configured for transportation events');
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Create notification content based on event type
    let subject = '';
    let content = '';

    if (type === 'INSERT') {
      subject = `New Trip Created: ${record.name}`;
      content = `
A new trip has been scheduled:

**Trip Name:** ${record.name}
**Type:** ${record.type}
**Date:** ${new Date(record.date).toLocaleDateString()}
**Destination:** ${record.destination || 'N/A'}
**Departure Time:** ${record.departure_time || 'N/A'}
**Return Time:** ${record.return_time || 'N/A'}
**Transportation:** ${record.transportation_type || 'N/A'}
**Driver:** ${record.driver || 'N/A'}
**Chaperone:** ${record.chaperone || 'N/A'}

Please review the trip details in the Transportation section.
      `.trim();
    } else if (type === 'UPDATE') {
      subject = `Trip Updated: ${record.name}`;
      content = `
A trip has been updated:

**Trip Name:** ${record.name}
**Type:** ${record.type}
**Date:** ${new Date(record.date).toLocaleDateString()}
**Status:** ${record.status}
**Destination:** ${record.destination || 'N/A'}
**Departure Time:** ${record.departure_time || 'N/A'}
**Return Time:** ${record.return_time || 'N/A'}
**Transportation:** ${record.transportation_type || 'N/A'}
**Driver:** ${record.driver || 'N/A'}

Please review the updated trip details in the Transportation section.
      `.trim();
    } else {
      console.log(`Unknown event type: ${type}`);
      return new Response(
        JSON.stringify({ message: 'Unknown event type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Send notifications
    await sendEmailNotifications(supabase, recipients, subject, content);

    console.log(`Successfully sent transportation notifications to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients_notified: recipients.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in notify-transportation-events:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
