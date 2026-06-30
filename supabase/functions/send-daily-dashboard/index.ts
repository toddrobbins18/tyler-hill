import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailNotifications } from "../_shared/emailHelpers.ts";
import {
  buildSpecialEventsEmailSection,
  escapeHtml,
} from "../_shared/dailyDashboardFormat.ts";

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

    console.log('Sending daily dashboard emails...');

    // Use current eastern time to get the correct "today"
    const easternTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    const todayYMD = easternTime.toISOString().split('T')[0];
    const season = easternTime.getFullYear().toString();

    // 1. Fetch all companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .eq('is_active', true);

    if (companiesError) throw companiesError;

    let emailsSent = 0;

    for (const company of companies || []) {
      const companyId = company.id;
      const isTylerHill = company.slug === 'tyler-hill-camp';
      const isTimberLakeWest = company.slug === 'timber-lake-west';
      const isTimberLakeCamp = company.slug === 'timber-lake-camp';

      // 2. Fetch recipients (all active staff/admins for this company)
      // Here we get everyone in `profiles` for this company with an email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', companyId)
        .not('email', 'is', null);

      if (!profiles || profiles.length === 0) continue;

      let subject = `Daily Dashboard - ${todayYMD}`;
      let content = ``;

      if (isTimberLakeWest || isTimberLakeCamp) {
        // Daily Wolf / Tiger Times
        subject = isTimberLakeWest ? `Daily Wolf - ${todayYMD}` : `Tiger Times - ${todayYMD}`;
        
        const { data: wolfContent } = await supabase
          .from('daily_wolf_content')
          .select('*')
          .eq('company_id', companyId)
          .eq('date', todayYMD)
          .maybeSingle();

        if (!wolfContent) {
          console.log(`No daily content found for ${company.name} on ${todayYMD}`);
          continue; // Skip if no content
        }

        content = `
          <h2>${subject}</h2>
          ${wolfContent.thought_of_day ? `<p><strong>Thought of the Day:</strong><br/>${wolfContent.thought_of_day}</p>` : ''}
          ${wolfContent.lunch_menu ? `<p><strong>Lunch:</strong><br/>${wolfContent.lunch_menu}</p>` : ''}
          ${wolfContent.dinner_menu ? `<p><strong>Dinner:</strong><br/>${wolfContent.dinner_menu}</p>` : ''}
          ${wolfContent.evening_activity ? `<p><strong>Evening Activity:</strong><br/>${wolfContent.evening_activity}</p>` : ''}
          ${wolfContent.birthday_campers ? `<p><strong>Birthdays:</strong><br/>${wolfContent.birthday_campers}</p>` : ''}
        `;
      } else if (isTylerHill) {
        // Tyler Hill Daily Dashboard
        subject = `Daily Dashboard - ${todayYMD}`;

        // Get daily notes
        const { data: noteRow } = await supabase
          .from('daily_notes')
          .select('content')
          .eq('company_id', companyId)
          .eq('date', todayYMD)
          .maybeSingle();

        // Get special events with divisions (match Nest dashboard)
        const { data: events } = await supabase
          .from('special_events_activities')
          .select(`
            title,
            time_slot,
            start_time,
            end_time,
            event_type,
            division:divisions(id, name),
            special_events_divisions(division_id, division:divisions(id, name))
          `)
          .eq('company_id', companyId)
          .eq('event_date', todayYMD);

        if (!noteRow && (!events || events.length === 0)) {
          console.log(`No dashboard content found for ${company.name} on ${todayYMD}`);
          continue;
        }

        content = `<h2>Tyler Hill Daily Dashboard - ${todayYMD}</h2>`;

        if (noteRow?.content) {
          content += `<h3>Daily Notes</h3><p>${escapeHtml(noteRow.content).replace(/\n/g, "<br>")}</p>`;
        }

        if (events && events.length > 0) {
          content += buildSpecialEventsEmailSection(
            "Special Events & Activities",
            events,
          );
        }
      } else {
        // Default generic dashboard
        content = `<h2>Daily Dashboard for ${company.name}</h2><p>Please log in to the portal to view today's schedule.</p>`;
      }

      // Send the email to all profiles
      console.log(`Sending ${subject} to ${profiles.length} users in ${company.name}`);
      try {
        await sendEmailNotifications(supabase, profiles, subject, content, companyId);
        emailsSent += profiles.length;
      } catch (companyError: any) {
        console.error(`Failed sending daily dashboard for ${company.name}:`, companyError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-daily-dashboard:', error);
    const message = error?.message ?? String(error);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
