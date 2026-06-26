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

    const { incident_id, action } = await req.json();
    console.log(`Processing incident notification: ${incident_id}, action: ${action}`);

    // Get incident details
    const { data: incident, error: incidentError } = await supabase
      .from('incident_reports')
      .select(`
        *,
        incident_children (
          child:children (
            id,
            name
          )
        )
      `)
      .eq('id', incident_id)
      .single();

    if (incidentError) {
      console.error('Error fetching incident:', incidentError);
      throw incidentError;
    }

    // Get recipients based on configuration
    const allRecipientsMap = new Map<string, any>();
    
    // First, get general recipients (health center, admins) without division filter
    const generalRecipients = await getRecipientsForEmailTypeWithFilters(supabase, 'incident_report', incident.company_id);
    generalRecipients.forEach(r => allRecipientsMap.set(r.id, r));

    // Then, if there are children with divisions, get their specific division leaders
    if (incident.incident_children && incident.incident_children.length > 0) {
      const divisionIds = new Set<string>();
      for (const ic of incident.incident_children) {
        if (ic.child?.division_id) {
          divisionIds.add(ic.child.division_id);
        }
      }

      for (const divId of divisionIds) {
        const divRecipients = await getRecipientsForEmailTypeWithFilters(supabase, 'incident_report', incident.company_id, divId);
        divRecipients.forEach(r => allRecipientsMap.set(r.id, r));
      }
    }

    const recipients = Array.from(allRecipientsMap.values());

    if (!recipients.length) {
      console.log('No recipients configured for incident reports');
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Build child names list
    const childNames = incident.incident_children
      ?.map((ic: any) => ic.child?.name)
      .filter(Boolean)
      .join(', ') || 'Unknown';

    // Create notification content
    const subject = `Incident Report: ${incident.type} - ${incident.severity}`;
    const content = `
A new incident report has been ${action === 'INSERT' ? 'created' : 'updated'}:

**Type:** ${incident.type}
**Severity:** ${incident.severity}
**Children Involved:** ${childNames}
**Date:** ${new Date(incident.date).toLocaleDateString()}
**Reported By:** ${incident.reported_by || 'N/A'}

**Description:**
${incident.description}

${incident.tags?.length ? `**Tags:** ${incident.tags.join(', ')}` : ''}

**Status:** ${incident.status}

Please review this incident in the Incident Reports section.
    `.trim();

    // Send notifications
    await sendEmailNotifications(supabase, recipients, subject, content, incident.company_id);

    // Log notification
    await supabase.from('notification_logs').insert({
      event_type: 'incident_report',
      event_id: incident_id,
      recipient_count: recipients.length,
      notification_version: 1,
    });

    console.log(`Successfully sent incident notifications to ${recipients.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipients_notified: recipients.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-incident-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
