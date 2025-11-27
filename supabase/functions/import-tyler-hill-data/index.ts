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
    
    // Debug: Log sample award IDs to verify format
    const sampleAwardIds = Array.from(awardMap.keys()).slice(0, 5);
    console.log('Sample award IDs in map:', JSON.stringify(sampleAwardIds));

    const importResults = {
      campersImported: 0,
      campersSkipped: 0,
      awardsCreated: 0,
      awardsSkipped: 0,
      errors: [] as string[],
    };

    // Step 1: Get all existing person_ids in bulk to avoid repeated queries
    console.log('Checking for existing campers...');
    const allPersonIds = campersData.map((c: any) => c._id?.$oid || c._id).filter(Boolean);
    
    const { data: existingChildren } = await supabase
      .from('children')
      .select('person_id, id')
      .eq('company_id', companyId)
      .eq('season', '2025')
      .in('person_id', allPersonIds);

    const existingPersonIdMap = new Map();
    (existingChildren || []).forEach((child: any) => {
      existingPersonIdMap.set(child.person_id, child.id);
    });

    console.log(`Found ${existingPersonIdMap.size} existing campers`);

    // Step 2: Prepare new campers for batch insert
    const newCampersToInsert: any[] = [];
    const camperIdMap = new Map(); // Maps person_id to child_id

    // Add existing campers to the map
    existingPersonIdMap.forEach((childId, personId) => {
      camperIdMap.set(personId, childId);
    });

    for (const camper of campersData) {
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

      // Skip if already exists
      if (existingPersonIdMap.has(personId)) {
        importResults.campersSkipped++;
        continue;
      }

      // Add to batch insert list
      newCampersToInsert.push({
        person_id: personId,
        name: name,
        company_id: companyId,
        season: '2025',
        status: 'active',
      });
    }

    console.log(`Prepared ${newCampersToInsert.length} new campers for batch insert`);

    // Step 3: Insert campers in batches of 50
    const CAMPER_BATCH_SIZE = 50;
    for (let i = 0; i < newCampersToInsert.length; i += CAMPER_BATCH_SIZE) {
      const batch = newCampersToInsert.slice(i, i + CAMPER_BATCH_SIZE);
      console.log(`Inserting camper batch ${Math.floor(i / CAMPER_BATCH_SIZE) + 1}/${Math.ceil(newCampersToInsert.length / CAMPER_BATCH_SIZE)}`);

      const { data: insertedChildren, error: insertError } = await supabase
        .from('children')
        .insert(batch)
        .select('id, person_id');

      if (insertError) {
        importResults.errors.push(`Failed to insert camper batch: ${insertError.message}`);
        importResults.campersSkipped += batch.length;
        continue;
      }

      // Update the camper ID map with newly inserted children
      (insertedChildren || []).forEach((child: any) => {
        camperIdMap.set(child.person_id, child.id);
      });

      importResults.campersImported += insertedChildren?.length || 0;
    }

    console.log(`Successfully imported ${importResults.campersImported} campers`);

    // Step 4: Prepare all awards for batch insert
    console.log('Preparing awards for batch insert...');
    const awardsToInsert: any[] = [];

    for (const camper of campersData) {
      const personId = camper._id?.$oid || camper._id;
      if (!personId) continue;

      const childId = camperIdMap.get(personId);
      if (!childId) continue;

      // Process awards for this camper
      if (camper.winner_ids && Array.isArray(camper.winner_ids) && camper.winner_ids.length > 0) {
        for (const awardIdObj of camper.winner_ids) {
          const awardId = awardIdObj?.$oid || awardIdObj;
          const awardDetails = awardMap.get(awardId);

          if (!awardDetails) {
            // Debug: Log first 10 missing awards with details
            if (importResults.awardsSkipped < 10) {
              console.log(`Award lookup failed - ID: "${awardId}" (type: ${typeof awardId}, length: ${String(awardId).length}, camper: ${personId})`);
            }
            // Silently skip - award not in awards data file
            importResults.awardsSkipped++;
            continue;
          }

          // Create award title based on type
          let title = '';
          switch (awardDetails.type?.toLowerCase()) {
            case 'cw':
              title = `Color War - ${awardDetails.description}`;
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

          awardsToInsert.push({
            child_id: childId,
            title: title,
            category: awardDetails.type || 'award',
            description: awardDetails.description,
            date: awardDate,
            season: '2025',
            company_id: companyId,
          });
        }
      }
    }

    console.log(`Prepared ${awardsToInsert.length} awards for batch insert`);

    // Step 5: Insert awards in batches of 100
    const AWARD_BATCH_SIZE = 100;
    for (let i = 0; i < awardsToInsert.length; i += AWARD_BATCH_SIZE) {
      const batch = awardsToInsert.slice(i, i + AWARD_BATCH_SIZE);
      console.log(`Inserting award batch ${Math.floor(i / AWARD_BATCH_SIZE) + 1}/${Math.ceil(awardsToInsert.length / AWARD_BATCH_SIZE)}`);

      const { data: insertedAwards, error: awardError } = await supabase
        .from('awards')
        .insert(batch)
        .select('id');

      if (awardError) {
        importResults.errors.push(`Failed to insert award batch: ${awardError.message}`);
        importResults.awardsSkipped += batch.length;
        continue;
      }

      importResults.awardsCreated += insertedAwards?.length || 0;
    }

    console.log('Import completed:', importResults);
    
    // Summary: Log info about skipped awards
    if (importResults.awardsSkipped > 0) {
      console.log(`Note: ${importResults.awardsSkipped} awards were skipped (award IDs not found in awards data file)`);
    }

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
