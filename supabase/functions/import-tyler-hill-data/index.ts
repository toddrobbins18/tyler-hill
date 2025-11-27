import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify user has admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .in('role', ['admin', 'super_admin']);

    if (!roles || roles.length === 0) {
      throw new Error('User must be an admin');
    }

    const { campersData, awardsData, companyId } = await req.json();

    if (!campersData || !awardsData || !companyId) {
      throw new Error('Missing required data: campersData, awardsData, or companyId');
    }

    console.log(`Starting import for company ${companyId}`);
    console.log(`Campers to import: ${campersData.length}`);
    console.log(`Awards data entries: ${awardsData.length}`);

    // Build award lookup map
    const awardMap = new Map();
    awardsData.forEach((award: any) => {
      const awardId = award._id?.$oid || award._id;
      if (awardId) {
        awardMap.set(awardId, {
          year: award.year,
          type: award.type,
          description: award.description || '',
        });
      }
    });

    console.log(`Built award map with ${awardMap.size} awards`);

    const importResults = {
      campersImported: 0,
      campersSkipped: 0,
      awardsCreated: 0,
      awardsSkipped: 0,
      errors: [] as string[],
    };

    // Process campers in batches of 100
    const BATCH_SIZE = 100;
    const camperIdMap = new Map(); // Maps person_id to child_id

    for (let i = 0; i < campersData.length; i += BATCH_SIZE) {
      const batch = campersData.slice(i, i + BATCH_SIZE);
      console.log(`Processing camper batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(campersData.length / BATCH_SIZE)}`);

      for (const camper of batch) {
        try {
          const personId = camper._id?.$oid || camper._id;
          if (!personId) {
            importResults.errors.push(`Camper missing _id: ${JSON.stringify(camper).substring(0, 100)}`);
            importResults.campersSkipped++;
            continue;
          }

          const name = `${camper.first || ''} ${camper.last || ''}`.trim();
          if (!name) {
            importResults.errors.push(`Camper ${personId} missing name`);
            importResults.campersSkipped++;
            continue;
          }

          // Check if camper already exists with this person_id and season
          const { data: existing } = await supabase
            .from('children')
            .select('id')
            .eq('person_id', personId)
            .eq('season', '2025')
            .eq('company_id', companyId)
            .single();

          if (existing) {
            importResults.campersSkipped++;
            camperIdMap.set(personId, existing.id);
            continue;
          }

          // Insert new camper
          const { data: newChild, error: insertError } = await supabase
            .from('children')
            .insert({
              person_id: personId,
              name: name,
              company_id: companyId,
              season: '2025',
              status: 'active',
            })
            .select('id')
            .single();

          if (insertError) {
            importResults.errors.push(`Failed to insert camper ${personId}: ${insertError.message}`);
            importResults.campersSkipped++;
            continue;
          }

          importResults.campersImported++;
          camperIdMap.set(personId, newChild.id);

          // Process awards for this camper
          if (camper.winner_ids && Array.isArray(camper.winner_ids) && camper.winner_ids.length > 0) {
            for (const awardIdObj of camper.winner_ids) {
              const awardId = awardIdObj?.$oid || awardIdObj;
              const awardDetails = awardMap.get(awardId);

              if (!awardDetails) {
                importResults.errors.push(`Award ${awardId} not found in awards data for camper ${personId}`);
                importResults.awardsSkipped++;
                continue;
              }

              // Create award title based on type
              let title = '';
              switch (awardDetails.type?.toLowerCase()) {
                case 'cw':
                  title = `Camper of the Week - ${awardDetails.description}`;
                  break;
                case 'starfish':
                  title = `Starfish Award - ${awardDetails.description}`;
                  break;
                case 'eoy':
                  title = `End of Year Award - ${awardDetails.description}`;
                  break;
                default:
                  title = `${awardDetails.type || 'Award'} - ${awardDetails.description}`;
              }

              const awardYear = awardDetails.year || 2025;
              const awardDate = `${awardYear}-07-01`; // July 1st of the award year

              const { error: awardError } = await supabase
                .from('awards')
                .insert({
                  child_id: newChild.id,
                  title: title,
                  category: awardDetails.type || 'award',
                  description: awardDetails.description,
                  date: awardDate,
                  season: '2025',
                  company_id: companyId,
                });

              if (awardError) {
                importResults.errors.push(`Failed to create award for camper ${personId}: ${awardError.message}`);
                importResults.awardsSkipped++;
              } else {
                importResults.awardsCreated++;
              }
            }
          }
        } catch (error: any) {
          importResults.errors.push(`Error processing camper: ${error.message}`);
          importResults.campersSkipped++;
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < campersData.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('Import completed:', importResults);

    return new Response(
      JSON.stringify({
        success: true,
        results: importResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
