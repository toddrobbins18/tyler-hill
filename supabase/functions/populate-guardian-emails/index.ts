import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CM_AUTH_URL = 'https://api.campminder.com/auth/apikey';
const CM_PERSONS_URL = 'https://api.campminder.com/persons';

// Rate limiting: 300ms between calls
const RATE_LIMIT_DELAY_MS = 300;
let lastApiCallTime = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  
  if (timeSinceLastCall < RATE_LIMIT_DELAY_MS && lastApiCallTime > 0) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastCall;
    await delay(waitTime);
  }
  
  lastApiCallTime = Date.now();
  return fetch(url, options);
}

async function getJwtToken(subscriptionKey: string, apiKey: string): Promise<{ token: string; clientIds: string[] }> {
  const authResponse = await rateLimitedFetch(CM_AUTH_URL, {
    method: 'GET',
    headers: {
      'Authorization': apiKey,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  const responseText = await authResponse.text();
  const authData = JSON.parse(responseText);

  if (!authResponse.ok || !authData.Token) {
    throw new Error(`Authentication failed: ${authData.Message || JSON.stringify(authData)}`);
  }

  const clientIds = authData.ClientIDs ? String(authData.ClientIDs).split(',').map((id: string) => id.trim()) : [];
  return { token: authData.Token, clientIds };
}

async function fetchPersonById(personId: string, token: string, subscriptionKey: string, clientId: string): Promise<any> {
  const url = `${CM_PERSONS_URL}/${personId}?clientid=${clientId}`;
  
  try {
    const response = await rateLimitedFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log(`[Rate Limit] Hit 429 for person ${personId}, pausing...`);
        await delay(5000);
        return null;
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[Fetch Error] Person ${personId}:`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const season = body.season || '2026';
    const batchSize = body.batch_size || 50; // Process 50 parents per run
    const companySlug = body.company; // Optional: target specific company

    console.log(`[Guardian Emails] Starting for season ${season}, batch size ${batchSize}`);

    // Get companies with CampMinder enabled
    let companiesQuery = supabase
      .from('companies')
      .select('*')
      .eq('campminder_sync_enabled', true)
      .eq('is_active', true);
    
    if (companySlug) {
      companiesQuery = companiesQuery.eq('slug', companySlug);
    }

    const { data: companies, error: companiesError } = await companiesQuery;

    if (companiesError || !companies?.length) {
      return new Response(JSON.stringify({ error: 'No CampMinder-enabled companies found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const results: any[] = [];

    for (const company of companies) {
      console.log(`\n[Guardian Emails] Processing ${company.name}...`);

      // Get API credentials
      const { data: decryptedApiKey } = await supabase.rpc('decrypt_secret', { 
        encrypted: company.campminder_api_key_encrypted 
      });
      const { data: decryptedSubKey } = await supabase.rpc('decrypt_secret', { 
        encrypted: company.campminder_subscription_key_encrypted 
      });

      if (!decryptedApiKey || !decryptedSubKey) {
        console.log(`[Guardian Emails] No credentials for ${company.name}`);
        results.push({ company: company.name, status: 'skipped', reason: 'No credentials' });
        continue;
      }

      // Authenticate with CampMinder
      let token: string, clientIds: string[];
      try {
        const auth = await getJwtToken(decryptedSubKey, decryptedApiKey);
        token = auth.token;
        clientIds = auth.clientIds;
      } catch (authError) {
        console.error(`[Guardian Emails] Auth failed for ${company.name}:`, authError);
        results.push({ company: company.name, status: 'error', reason: 'Auth failed' });
        continue;
      }

      const clientId = clientIds[0];

      // Find campers missing guardian_email but having a person_id
      const { data: campersNeedingEmail, error: campersError } = await supabase
        .from('children')
        .select('id, person_id, name')
        .eq('company_id', company.id)
        .eq('season', season)
        .is('guardian_email', null)
        .not('person_id', 'is', null)
        .limit(batchSize);

      if (campersError || !campersNeedingEmail?.length) {
        console.log(`[Guardian Emails] No campers need email for ${company.name}`);
        results.push({ company: company.name, status: 'complete', updated: 0 });
        continue;
      }

      console.log(`[Guardian Emails] Found ${campersNeedingEmail.length} campers needing guardian email`);

      let updatedCount = 0;
      let failedCount = 0;

      for (const camper of campersNeedingEmail) {
        // Fetch the camper's person data to get Relatives
        const camperPerson = await fetchPersonById(camper.person_id, token, decryptedSubKey, clientId);
        
        if (!camperPerson) {
          failedCount++;
          continue;
        }

        const relatives = camperPerson.Relatives || [];
        
        // Find P1 parent
        const p1Parent = relatives.find((r: any) => r.IsPrimary === true);
        const guardian = p1Parent || 
                        relatives.find((r: any) => r.IsGuardian === true) || 
                        relatives[0];

        if (!guardian?.ID) {
          failedCount++;
          continue;
        }

        const parentId = String(guardian.ID);

        // Fetch parent person data
        const parentPerson = await fetchPersonById(parentId, token, decryptedSubKey, clientId);
        
        if (!parentPerson) {
          failedCount++;
          continue;
        }

        // Extract email from ContactDetails
        let guardianEmail: string | null = null;
        if (parentPerson.ContactDetails?.Emails?.length > 0) {
          const loginEmail = parentPerson.ContactDetails.Emails.find((e: any) => e.IsLogin);
          guardianEmail = loginEmail?.Address || parentPerson.ContactDetails.Emails[0]?.Address;
        }

        // Extract name if missing
        let guardianName: string | null = null;
        if (parentPerson.Name) {
          guardianName = `${parentPerson.Name.First || ''} ${parentPerson.Name.Last || ''}`.trim() || null;
        }

        // Extract phone if missing
        let guardianPhone: string | null = null;
        if (parentPerson.ContactDetails?.PhoneNumbers?.length > 0) {
          const mobilePhone = parentPerson.ContactDetails.PhoneNumbers.find((p: any) => 
            p.Type === 'Mobile' || p.Type === 'Cell' || p.TypeID === 0 || p.TypeID === 2
          );
          guardianPhone = mobilePhone?.Number || parentPerson.ContactDetails.PhoneNumbers[0]?.Number;
        }

        // Update the camper record
        const updateData: Record<string, any> = {};
        if (guardianEmail) updateData.guardian_email = guardianEmail;
        if (guardianName) updateData.guardian_name = guardianName;
        if (guardianPhone) updateData.guardian_phone = guardianPhone;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('children')
            .update(updateData)
            .eq('id', camper.id);

          if (updateError) {
            console.error(`[Guardian Emails] Failed to update ${camper.name}:`, updateError);
            failedCount++;
          } else {
            updatedCount++;
            if (updatedCount <= 5) {
              console.log(`[Guardian Emails] Updated ${camper.name}: email=${guardianEmail ? 'yes' : 'no'}, name=${guardianName ? 'yes' : 'no'}`);
            }
          }
        } else {
          failedCount++;
        }
      }

      console.log(`[Guardian Emails] ${company.name}: ${updatedCount} updated, ${failedCount} failed`);
      
      const remaining = await supabase
        .from('children')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('season', season)
        .is('guardian_email', null)
        .not('person_id', 'is', null);

      results.push({ 
        company: company.name, 
        status: 'processed',
        updated: updatedCount,
        failed: failedCount,
        remaining: remaining.count || 0
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      message: 'Run again to process more batches until remaining=0'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Guardian Emails] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
