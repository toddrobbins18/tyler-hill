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

async function countCampersNeedingEmail(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  season: string,
): Promise<number> {
  const { count } = await supabase
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('season', season)
    .eq('status', 'active')
    .or('guardian_email.is.null,guardian_email.eq.')
    .not('person_id', 'is', null);
  return count ?? 0;
}

async function getJwtToken(
  subscriptionKey: string,
  apiKey: string,
  retries = 4,
): Promise<{ token: string; clientIds: string[] }> {
  let lastError = 'Unknown auth error';

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      const waitMs = 4000 * attempt;
      console.log(`[Guardian Emails] Auth retry ${attempt + 1}/${retries} after ${waitMs}ms`);
      await delay(waitMs);
    }

    const authResponse = await rateLimitedFetch(CM_AUTH_URL, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    const responseText = await authResponse.text();
    let authData: { Token?: string; ClientIDs?: string; Message?: string } = {};
    try {
      authData = JSON.parse(responseText);
    } catch {
      lastError = `Invalid auth response (${authResponse.status})`;
      continue;
    }

    if (authResponse.ok && authData.Token) {
      const clientIds = authData.ClientIDs
        ? String(authData.ClientIDs).split(',').map((id: string) => id.trim())
        : [];
      return { token: authData.Token, clientIds };
    }

    lastError = authData.Message || `HTTP ${authResponse.status}`;
    console.error(`[Guardian Emails] Auth attempt ${attempt + 1} failed:`, lastError);
  }

  throw new Error(`Authentication failed: ${lastError}`);
}

function extractRelativeContact(relative: any): {
  email: string | null;
  name: string | null;
  phone: string | null;
} {
  const email =
    relative?.Login ||
    relative?.LoginEmail ||
    relative?.Email ||
    relative?.EmailAddress ||
    relative?.PrimaryEmail ||
    relative?.ParentEmail ||
    relative?.P1Login ||
    relative?.P1Email ||
    null;

  let name: string | null = null;
  if (relative?.Name && typeof relative.Name === 'object') {
    name = `${relative.Name.First || relative.Name.first || ''} ${relative.Name.Last || relative.Name.last || ''}`.trim() || null;
  } else if (typeof relative?.Name === 'string') {
    name = relative.Name.trim() || null;
  } else {
    name =
      relative?.FullName ||
      `${relative?.FirstName || relative?.First || ''} ${relative?.LastName || relative?.Last || ''}`.trim() ||
      null;
  }

  const phone =
    relative?.Phone ||
    relative?.PhoneNumber ||
    relative?.MobilePhone ||
    relative?.CellPhone ||
    relative?.PrimaryPhone ||
    null;

  return {
    email: typeof email === 'string' && email.trim() ? email.trim() : null,
    name: typeof name === 'string' && name.trim() ? name.trim() : null,
    phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
  };
}

function extractPersonContact(person: any): {
  email: string | null;
  name: string | null;
  phone: string | null;
} {
  let email: string | null = null;
  if (person?.ContactDetails?.Emails?.length > 0) {
    const loginEmail = person.ContactDetails.Emails.find((e: any) => e.IsLogin || e.IsPrimary);
    email = loginEmail?.Address || person.ContactDetails.Emails[0]?.Address || null;
  }

  let name: string | null = null;
  if (person?.Name) {
    name = `${person.Name.First || ''} ${person.Name.Last || ''}`.trim() || null;
  }

  let phone: string | null = null;
  if (person?.ContactDetails?.PhoneNumbers?.length > 0) {
    const mobilePhone = person.ContactDetails.PhoneNumbers.find((p: any) =>
      p.Type === 'Mobile' || p.Type === 'Cell' || p.TypeID === 0 || p.TypeID === 2
    );
    phone = mobilePhone?.Number || person.ContactDetails.PhoneNumbers[0]?.Number || null;
  }

  return { email, name, phone };
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
    const batchSize = Math.min(body.batch_size || 25, 50);
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
        const remaining = await countCampersNeedingEmail(supabase, company.id, season);
        results.push({
          company: company.name,
          status: 'error',
          reason: 'Auth failed — wait 30s and click Parent emails again',
          updated: 0,
          failed: 0,
          remaining,
        });
        continue;
      }

      const clientId = clientIds[0];

      // Campers missing guardian email (null or blank) with a CampMinder person_id
      const { data: campersNeedingEmail, error: campersError } = await supabase
        .from('children')
        .select('id, person_id, name, guardian_name, guardian_phone')
        .eq('company_id', company.id)
        .eq('season', season)
        .eq('status', 'active')
        .or('guardian_email.is.null,guardian_email.eq.')
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
        const fromRelative = extractRelativeContact(guardian);
        let guardianEmail = fromRelative.email;
        let guardianName = fromRelative.name;
        let guardianPhone = fromRelative.phone;

        // Fetch full parent person when relative stub lacks email (common for day camp)
        if (!guardianEmail || !guardianName || !guardianPhone) {
          const parentPerson = await fetchPersonById(parentId, token, decryptedSubKey, clientId);
          if (!parentPerson) {
            failedCount++;
            continue;
          }
          const fromParent = extractPersonContact(parentPerson);
          guardianEmail = guardianEmail || fromParent.email;
          guardianName = guardianName || fromParent.name;
          guardianPhone = guardianPhone || fromParent.phone;
        }

        // Update the camper record
        const updateData: Record<string, any> = {};
        if (guardianEmail) updateData.guardian_email = guardianEmail;
        if (guardianName && !camper.guardian_name) updateData.guardian_name = guardianName;
        if (guardianPhone && !camper.guardian_phone) updateData.guardian_phone = guardianPhone;

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
        .or('guardian_email.is.null,guardian_email.eq.')
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
