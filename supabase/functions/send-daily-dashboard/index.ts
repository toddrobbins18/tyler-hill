import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailNotifications } from "../_shared/emailHelpers.ts";
import {
  buildDailyWolfBulletinHtml,
  fetchDailyWolfBulletinData,
} from "../_shared/dailyWolfBulletinEmail.ts";
import {
  buildTylerHillBulletinHtml,
  fetchTylerHillBulletinData,
} from "../_shared/tylerHillBulletinEmail.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_WOLF_CONFIG = {
  mastheadTitle: "THE DAILY WOLF",
  campSubtitle: "Timber Lake West",
  defaultNotes: "Have a great day at Timber Lake West!",
};

const TIGER_TIMES_CONFIG = {
  mastheadTitle: "TIGER TIMES",
  campSubtitle: "Timber Lake Camp",
  defaultNotes: "Have a great day at Timber Lake Camp!",
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

    const easternTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    const todayYMD = easternTime.toISOString().split('T')[0];
    const season = easternTime.getFullYear().toString();

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

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('company_id', companyId)
        .not('email', 'is', null);

      if (!profiles || profiles.length === 0) continue;

      let subject = `Daily Dashboard - ${todayYMD}`;
      let content = ``;

      if (isTimberLakeWest || isTimberLakeCamp) {
        const bulletinConfig = isTimberLakeWest ? DAILY_WOLF_CONFIG : TIGER_TIMES_CONFIG;
        subject = isTimberLakeWest ? `Daily Wolf - ${todayYMD}` : `Tiger Times - ${todayYMD}`;

        const bulletinData = await fetchDailyWolfBulletinData(
          supabase,
          companyId,
          todayYMD,
          season,
        );

        content = buildDailyWolfBulletinHtml(todayYMD, bulletinData, bulletinConfig);
      } else if (isTylerHill) {
        subject = `Tyler Hill Daily News - ${todayYMD}`;

        const bulletinData = await fetchTylerHillBulletinData(
          supabase,
          companyId,
          todayYMD,
          season,
        );

        content = buildTylerHillBulletinHtml(todayYMD, bulletinData);
      } else {
        content = `<h2>Daily Dashboard for ${company.name}</h2><p>Please log in to the portal to view today's schedule.</p>`;
      }

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
