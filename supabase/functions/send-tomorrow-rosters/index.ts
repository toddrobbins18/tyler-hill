import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailNotifications } from "../_shared/emailHelpers.ts";
import { easternSeasonYear, easternTodayYMD, formatBulletinDisplayDate } from "../_shared/dailyDashboardFormat.ts";
import {
  buildRosterGroupedByDivisionHtml,
  buildStaffAssignmentsHtml,
} from "../_shared/rosterEmailContent.ts";
import { isDailyBulletinOnlyCamp } from "../_shared/campEmailPolicy.ts";

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

    const season = easternSeasonYear();
    
    // Calculate tomorrow's date in Eastern Time
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYMD = easternTodayYMD(tomorrow);

    console.log(`Checking for sports rosters for ${tomorrowYMD} (${season})...`);

    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('is_active', true);

    if (companiesError) throw companiesError;

    let emailsSent = 0;

    for (const company of companies || []) {
      if (isDailyBulletinOnlyCamp(company.slug)) continue;

      const companyId = company.id;

      // 1. Fetch all sports events for tomorrow
      const { data: events, error: eventsError } = await supabase
        .from('sports_calendar')
        .select(`
          id,
          title,
          time,
          location,
          sport_type,
          custom_sport_type,
          event_date,
          sports_event_roster(
            child:children(
              id,
              name,
              division_id,
              allergies,
              division:divisions(id, name)
            )
          ),
          sports_event_staff(
            role,
            staff(name, role, allergies)
          )
        `)
        .eq('company_id', companyId)
        .eq('season', season)
        .eq('event_date', tomorrowYMD);

      if (eventsError) {
        console.error(`Error fetching events for ${company.name}:`, eventsError);
        continue;
      }

      if (!events || events.length === 0) {
        console.log(`No sports events found for ${company.name} on ${tomorrowYMD}`);
        continue;
      }

      // 2. Identify all unique divisions involved in tomorrow's games
      const divisionIds = new Set<string>();
      events.forEach(event => {
        event.sports_event_roster?.forEach((r: any) => {
          if (r.child?.division_id) {
            divisionIds.add(r.child.division_id);
          }
        });
      });

      if (divisionIds.size === 0) {
        console.log(`No rosters found for ${company.name} on ${tomorrowYMD}`);
        continue;
      }

      // 3. Find division leaders for these divisions
      // We look for users with 'division_leader' role or tag who have permission for these divisions
      const { data: divPerms, error: permsError } = await supabase
        .from('division_permissions')
        .select(`
          user_id,
          division_id,
          profile:profiles!inner(id, email, full_name)
        `)
        .eq('can_access', true)
        .in('division_id', Array.from(divisionIds));

      if (permsError) {
        console.error(`Error fetching division permissions for ${company.name}:`, permsError);
        continue;
      }

      // 4. Map each leader to their relevant events and campers
      const leaderMap = new Map<string, { profile: any, divisions: Set<string> }>();
      divPerms?.forEach((p: any) => {
        if (!leaderMap.has(p.user_id)) {
          leaderMap.set(p.user_id, { profile: p.profile, divisions: new Set() });
        }
        leaderMap.get(p.user_id)!.divisions.add(p.division_id);
      });

      // 5. Construct and send emails
      for (const [userId, leaderData] of leaderMap.entries()) {
        const { profile, divisions } = leaderData;
        
        let hasRelevantContent = false;
        let content = `<h2>Roster Preview for Tomorrow</h2>`;
        content += `<p>Hi ${profile.full_name},</p>`;
        content += `<p>Here are the sports rosters for your division(s) tomorrow, <strong>${formatBulletinDisplayDate(tomorrowYMD)}</strong>:</p>`;

        events.forEach(event => {
          const myCampers = event.sports_event_roster
            ?.map((r: any) => r.child)
            .filter((c: any) => c && divisions.has(c.division_id)) || [];

          if (myCampers.length > 0) {
            hasRelevantContent = true;
            const displaySport = event.custom_sport_type || event.sport_type;
            content += `<div style="margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">`;
            content += `<h3 style="margin-top: 0; color: #13B4B2;">${event.title}</h3>`;
            content += `<p style="margin-bottom: 10px;"><strong>Sport:</strong> ${displaySport}<br/>`;
            if (event.time) content += `<strong>Time:</strong> ${event.time}<br/>`;
            if (event.location) content += `<strong>Location:</strong> ${event.location}</p>`;
            
            content += `<h4 style="margin-bottom: 5px;">Your division campers on this roster:</h4>`;
            content += buildRosterGroupedByDivisionHtml(myCampers, { divisionFilter: divisions });
            content += buildStaffAssignmentsHtml(event.sports_event_staff || []);
            content += `</div>`;
          }
        });

        if (hasRelevantContent) {
          content += `<p>Please log in to the portal if you need to make any last-minute adjustments to these rosters.</p>`;
          const subject = `Roster Preview: Tomorrow's Games - ${formatBulletinDisplayDate(tomorrowYMD)}`;
          
          try {
            await sendEmailNotifications(supabase, [profile], subject, content, companyId);
            emailsSent++;
          } catch (sendError) {
            console.error(`Failed to send roster preview to ${profile.email}:`, sendError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent, date: tomorrowYMD }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-tomorrow-rosters:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
