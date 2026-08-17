import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailNotifications } from "../_shared/emailHelpers.ts";
import { isAllEmailsStoppedCamp } from "../_shared/campEmailPolicy.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to get day name from Date
function getDayName(date: Date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
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

    const now = new Date();
    // Use Eastern Time for the date
    const etString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
    const etDate = new Date(etString);
    const todayStr = etDate.toISOString().split('T')[0];
    const dayName = getDayName(etDate);

    console.log(`Sending daily tutoring summary for ${todayStr} (${dayName})`);

    // 1. Get all active companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('is_active', true);

    if (companiesError) throw companiesError;

    let totalEmailsSent = 0;

    for (const company of companies) {
      if (isAllEmailsStoppedCamp(company.slug)) continue;

      // 2. Fetch all tutoring/therapy sessions for this company that happen today
      // For Timber Lake Camp, we check 'weekdays'. For others, we check start_date/end_date.
      const isTimberLake = company.slug === 'timber-lake-camp';

      let query = supabase
        .from('tutoring_therapy')
        .select(`
          *,
          children (
            id,
            name,
            division_id
          )
        `)
        .eq('company_id', company.id);

      if (isTimberLake) {
        query = query.contains('weekdays', [dayName]);
      } else {
        query = query
          .lte('start_date', todayStr)
          .or(`end_date.gte.${todayStr},end_date.is.null`);
      }

      const { data: sessions, error: sessionsError } = await query;
      if (sessionsError) {
        console.error(`Error fetching sessions for company ${company.id}:`, sessionsError);
        continue;
      }

      if (!sessions || sessions.length === 0) {
        console.log(`No sessions today for company ${company.name}`);
        continue;
      }

      // 3. Group sessions by division_id
      const sessionsByDivision = new Map<string, any[]>();
      for (const session of sessions) {
        if (!session.children?.division_id) continue;
        const divId = session.children.division_id;
        if (!sessionsByDivision.has(divId)) {
          sessionsByDivision.set(divId, []);
        }
        sessionsByDivision.get(divId)!.push(session);
      }

      // 4. Fetch Division Leaders for this company
      const { data: dlRoles, error: dlRolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('company_id', company.id)
        .eq('role', 'division_leader');

      if (dlRolesError || !dlRoles || dlRoles.length === 0) continue;
      const dlUserIds = dlRoles.map(r => r.user_id);

      // Fetch division permissions for these DLs
      const { data: divPerms, error: divPermsError } = await supabase
        .from('division_permissions')
        .select('user_id, division_id')
        .eq('company_id', company.id)
        .eq('can_access', true)
        .in('user_id', dlUserIds);

      if (divPermsError || !divPerms || divPerms.length === 0) continue;

      // Map DLs to the divisions they can access
      const dlsWithDivisions = new Map<string, string[]>();
      for (const perm of divPerms) {
        if (!dlsWithDivisions.has(perm.user_id)) {
          dlsWithDivisions.set(perm.user_id, []);
        }
        dlsWithDivisions.get(perm.user_id)!.push(perm.division_id);
      }

      // Fetch DL profiles
      const { data: dlProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('company_id', company.id)
        .in('id', Array.from(dlsWithDivisions.keys()));

      if (!dlProfiles || dlProfiles.length === 0) continue;

      // 5. Send customized emails to each DL
      for (const profile of dlProfiles) {
        const accessibleDivisions = dlsWithDivisions.get(profile.id) || [];
        if (accessibleDivisions.length === 0) continue;

        // Gather all sessions for the divisions this DL has access to
        const dlSessions = [];
        for (const divId of accessibleDivisions) {
          if (sessionsByDivision.has(divId)) {
            dlSessions.push(...sessionsByDivision.get(divId)!);
          }
        }

        if (dlSessions.length === 0) continue;

        // Build email content
        const titleText = isTimberLake ? 'Private Lessons' : 'Tutoring & Therapy';
        const subject = `Daily ${titleText} Summary for ${todayStr}`;
        
        let content = `Here is your daily summary of ${titleText} sessions for your campers today (${todayStr}):\n\n`;
        
        // Group by camper
        dlSessions.sort((a, b) => (a.children?.name || '').localeCompare(b.children?.name || ''));
        
        for (const session of dlSessions) {
          content += `**Camper:** ${session.children?.name || 'Unknown'}\n`;
          content += `**Service:** ${session.service_type}\n`;
          if (session.instructor) content += `**Instructor:** ${session.instructor}\n`;
          if (session.schedule_periods?.length) content += `**Periods:** ${session.schedule_periods.join(', ')}\n`;
          if (session.notes) content += `**Notes:** ${session.notes}\n`;
          content += `\n`;
        }

        await sendEmailNotifications(supabase, [profile], subject, content, company.id);
        totalEmailsSent++;
      }
    }

    return new Response(JSON.stringify({ success: true, emails_sent: totalEmailsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error sending daily tutoring summary:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});