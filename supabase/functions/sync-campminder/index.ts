import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// CampMinder API Base URLs
const CM_AUTH_URL = 'https://webapi.campminder.com/api/auth/GetJWTWithApiKey';
const CM_PERSONS_URL = 'https://api.campminder.com/persons';
const CM_STAFF_URL = 'https://api.campminder.com/staff';
const CM_DIVISIONS_URL = 'https://api.campminder.com/divisions';
const CM_BUNKS_URL = 'https://api.campminder.com/bunks';
const CM_SESSIONS_URL = 'https://api.campminder.com/sessions';

interface SyncResult {
  campers: { imported: number; updated: number; errors: number };
  staff: { imported: number; updated: number; errors: number };
  divisions: { imported: number; updated: number; errors: number };
  sessions: { imported: number; updated: number; errors: number };
}

async function getJwtToken(subscriptionKey: string, apiKey: string): Promise<{ token: string; clientIds: string[] }> {
  console.log('Authenticating with CampMinder...');
  
  const authResponse = await fetch(CM_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
    body: JSON.stringify({
      ApiKey: apiKey,
      SubscriptionKey: subscriptionKey,
    }),
  });

  if (!authResponse.ok) {
    throw new Error(`Authentication failed: ${authResponse.status}`);
  }

  const authData = await authResponse.json();
  
  if (!authData.Token) {
    throw new Error('No token received from CampMinder');
  }

  const clientIds = authData.ClientIDs ? authData.ClientIDs.split(',').map((id: string) => id.trim()) : [];
  
  console.log(`Authenticated successfully. ClientIDs: ${clientIds.join(', ')}`);
  
  return { token: authData.Token, clientIds };
}

async function fetchPaginatedData(
  baseUrl: string, 
  token: string, 
  subscriptionKey: string,
  params: Record<string, string | number>
): Promise<any[]> {
  const results: any[] = [];
  let pageNumber = 1;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const queryParams = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      pagenumber: String(pageNumber),
      pagesize: String(pageSize),
    });

    const response = await fetch(`${baseUrl}?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!response.ok) {
      console.error(`API error: ${response.status} - ${await response.text()}`);
      break;
    }

    const data = await response.json();
    const items = data.Results || data || [];
    results.push(...items);

    // Check if there's more data
    hasMore = items.length === pageSize;
    pageNumber++;

    if (pageNumber > 100) {
      console.warn('Reached maximum page limit (100)');
      break;
    }
  }

  return results;
}

async function syncDivisions(
  supabase: any,
  token: string,
  subscriptionKey: string,
  clientId: string,
  companyId: string
): Promise<{ imported: number; updated: number; errors: number }> {
  console.log('Syncing divisions...');
  let imported = 0, updated = 0, errors = 0;

  try {
    const divisions = await fetchPaginatedData(CM_DIVISIONS_URL, token, subscriptionKey, {
      clientid: clientId,
    });

    console.log(`Found ${divisions.length} divisions in CampMinder`);

    for (const div of divisions) {
      try {
        // Map CampMinder gender to our format
        let gender = 'coed';
        if (div.GenderID === 0) gender = 'female';
        else if (div.GenderID === 1) gender = 'male';

        const divisionData = {
          name: div.Name,
          gender,
          company_id: companyId,
          sort_order: div.SortOrder || divisions.indexOf(div),
        };

        // Check if division exists by name
        const { data: existing } = await supabase
          .from('divisions')
          .select('id')
          .eq('company_id', companyId)
          .eq('name', div.Name)
          .single();

        if (existing) {
          await supabase
            .from('divisions')
            .update(divisionData)
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase
            .from('divisions')
            .insert(divisionData);
          imported++;
        }
      } catch (err) {
        console.error(`Error syncing division ${div.Name}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('Error fetching divisions:', err);
    errors++;
  }

  console.log(`Divisions sync complete: ${imported} imported, ${updated} updated, ${errors} errors`);
  return { imported, updated, errors };
}

async function syncCampers(
  supabase: any,
  token: string,
  subscriptionKey: string,
  clientId: string,
  companyId: string,
  seasonId: number
): Promise<{ imported: number; updated: number; errors: number }> {
  console.log('Syncing campers...');
  let imported = 0, updated = 0, errors = 0;

  try {
    // Get division mapping
    const { data: divisions } = await supabase
      .from('divisions')
      .select('id, name')
      .eq('company_id', companyId);
    
    const divisionMap = new Map(divisions?.map((d: any) => [d.name, d.id]) || []);

    // Fetch persons with camper details
    const persons = await fetchPaginatedData(CM_PERSONS_URL, token, subscriptionKey, {
      clientid: clientId,
      seasonid: seasonId,
      includecamperdetails: 'true',
      includecontactdetails: 'true',
      includerelatives: 'true',
    });

    console.log(`Found ${persons.length} persons in CampMinder`);

    // Filter for campers (those with CamperDetails)
    const campers = persons.filter((p: any) => p.CamperDetails);
    console.log(`Found ${campers.length} campers`);

    for (const person of campers) {
      try {
        const name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim();
        if (!name) continue;

        // Find division
        let divisionId = null;
        if (person.CamperDetails?.DivisionID) {
          // We need to find division by CampMinder ID - for now match by grade range
          // In production, you'd store CM division IDs
        }

        // Extract guardian info
        let guardianEmail = '';
        let guardianPhone = '';
        if (person.ContactDetails?.Emails?.length > 0) {
          guardianEmail = person.ContactDetails.Emails[0].Address;
        }
        if (person.ContactDetails?.PhoneNumbers?.length > 0) {
          guardianPhone = person.ContactDetails.PhoneNumbers[0].Number;
        }

        // Map gender
        let gender = null;
        if (person.GenderID === 0) gender = 'Female';
        else if (person.GenderID === 1) gender = 'Male';

        // Map grade
        const gradeMap: Record<number, string> = {
          0: 'Pre-K', 1: 'K', 2: '1st', 3: '2nd', 4: '3rd', 5: '4th',
          6: '5th', 7: '6th', 8: '7th', 9: '8th', 10: '9th', 11: '10th', 12: '11th', 13: '12th'
        };
        const grade = gradeMap[person.CamperDetails?.CampGradeID] || null;

        const camperData = {
          name,
          person_id: String(person.ID),
          company_id: companyId,
          season: String(seasonId),
          date_of_birth: person.DateOfBirth || null,
          gender,
          grade,
          guardian_email: guardianEmail,
          guardian_phone: guardianPhone,
          status: 'active',
        };

        // Check if camper exists
        const { data: existing } = await supabase
          .from('children')
          .select('id')
          .eq('company_id', companyId)
          .eq('person_id', String(person.ID))
          .eq('season', String(seasonId))
          .single();

        if (existing) {
          await supabase
            .from('children')
            .update(camperData)
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase
            .from('children')
            .insert(camperData);
          imported++;
        }
      } catch (err) {
        console.error(`Error syncing camper ${person.ID}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('Error fetching campers:', err);
    errors++;
  }

  console.log(`Campers sync complete: ${imported} imported, ${updated} updated, ${errors} errors`);
  return { imported, updated, errors };
}

async function syncStaff(
  supabase: any,
  token: string,
  subscriptionKey: string,
  clientId: string,
  companyId: string,
  seasonId: number
): Promise<{ imported: number; updated: number; errors: number }> {
  console.log('Syncing staff...');
  let imported = 0, updated = 0, errors = 0;

  try {
    // Fetch positions and organizational categories first
    const positions = await fetchPaginatedData(`${CM_STAFF_URL}/positions`, token, subscriptionKey, {
      clientid: clientId,
    });
    const positionMap = new Map(positions.map((p: any) => [p.ID, p.Name]));

    // Fetch active staff
    const staffMembers = await fetchPaginatedData(CM_STAFF_URL, token, subscriptionKey, {
      clientid: clientId,
      seasonid: seasonId,
      status: 1, // Active staff
    });

    console.log(`Found ${staffMembers.length} active staff in CampMinder`);

    // Fetch person details for each staff member
    for (const staff of staffMembers) {
      try {
        // Get person details
        const personResponse = await fetch(`${CM_PERSONS_URL}/${staff.PersonID}?clientid=${clientId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': subscriptionKey,
          },
        });

        if (!personResponse.ok) {
          console.error(`Failed to fetch person ${staff.PersonID}`);
          errors++;
          continue;
        }

        const person = await personResponse.json();
        const name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim();
        if (!name) continue;

        // Get position name
        const position = positionMap.get(staff.Position1ID) || 'Staff';

        // Get contact info
        let email = '';
        let phone = '';
        if (person.ContactDetails?.Emails?.length > 0) {
          email = person.ContactDetails.Emails[0].Address;
        }
        if (person.ContactDetails?.PhoneNumbers?.length > 0) {
          phone = person.ContactDetails.PhoneNumbers[0].Number;
        }

        const staffData = {
          name,
          person_id: String(staff.PersonID),
          company_id: companyId,
          season: String(seasonId),
          role: position,
          email,
          phone,
          status: 'active',
          start_date: staff.EmploymentStartDate || null,
          end_date: staff.EmploymentEndDate || null,
        };

        // Check if staff exists
        const { data: existing } = await supabase
          .from('staff')
          .select('id')
          .eq('company_id', companyId)
          .eq('person_id', String(staff.PersonID))
          .single();

        if (existing) {
          await supabase
            .from('staff')
            .update(staffData)
            .eq('id', existing.id);
          updated++;
        } else {
          await supabase
            .from('staff')
            .insert(staffData);
          imported++;
        }
      } catch (err) {
        console.error(`Error syncing staff ${staff.PersonID}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('Error fetching staff:', err);
    errors++;
  }

  console.log(`Staff sync complete: ${imported} imported, ${updated} updated, ${errors} errors`);
  return { imported, updated, errors };
}

async function syncSessions(
  supabase: any,
  token: string,
  subscriptionKey: string,
  clientId: string,
  companyId: string,
  seasonId: number
): Promise<{ imported: number; updated: number; errors: number }> {
  console.log('Syncing sessions and enrollment...');
  let imported = 0, updated = 0, errors = 0;

  try {
    // Fetch sessions
    const sessions = await fetchPaginatedData(CM_SESSIONS_URL, token, subscriptionKey, {
      clientid: clientId,
      seasonid: seasonId,
    });

    console.log(`Found ${sessions.length} sessions in CampMinder`);

    // Fetch enrolled attendees
    const attendees = await fetchPaginatedData(`${CM_SESSIONS_URL}/attendees`, token, subscriptionKey, {
      clientid: clientId,
      seasonid: seasonId,
      status: 2, // Enrolled
    });

    console.log(`Found ${attendees.length} enrolled attendees`);

    // Create a map of person ID to sessions
    const enrollmentMap = new Map<number, any[]>();
    for (const attendee of attendees) {
      const sessions = attendee.SessionProgramStatus || [];
      if (!enrollmentMap.has(attendee.PersonID)) {
        enrollmentMap.set(attendee.PersonID, []);
      }
      enrollmentMap.get(attendee.PersonID)!.push(...sessions);
    }

    // Update children with session info
    for (const [personId, sessionData] of enrollmentMap) {
      try {
        // Find the session names for this camper
        const sessionNames = sessionData
          .filter((s: any) => s.StatusID === 2) // Enrolled
          .map((s: any) => {
            const session = sessions.find((sess: any) => sess.ID === s.SessionID);
            return session?.Name || `Session ${s.SessionID}`;
          })
          .join(', ');

        if (sessionNames) {
          // Update the child's session field
          await supabase
            .from('children')
            .update({ session: sessionNames })
            .eq('company_id', companyId)
            .eq('person_id', String(personId))
            .eq('season', String(seasonId));
          
          updated++;
        }
      } catch (err) {
        console.error(`Error updating session for person ${personId}:`, err);
        errors++;
      }
    }

    imported = sessions.length; // Count sessions found
  } catch (err) {
    console.error('Error fetching sessions:', err);
    errors++;
  }

  console.log(`Sessions sync complete: ${imported} sessions found, ${updated} campers updated, ${errors} errors`);
  return { imported, updated, errors };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, season_id } = await req.json().catch(() => ({}));

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If no company_id provided, sync all companies with CampMinder enabled
    let companiesToSync: any[] = [];

    if (company_id) {
      const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', company_id)
        .single();

      if (error || !company) {
        throw new Error('Company not found');
      }
      companiesToSync = [company];
    } else {
      // Get all companies with CampMinder sync enabled
      const { data: companies, error } = await supabase
        .from('companies')
        .select('*')
        .eq('campminder_sync_enabled', true)
        .not('campminder_api_key_encrypted', 'is', null)
        .not('campminder_subscription_key_encrypted', 'is', null);

      if (error) {
        throw new Error(`Error fetching companies: ${error.message}`);
      }

      companiesToSync = companies || [];
    }

    console.log(`Starting CampMinder sync for ${companiesToSync.length} companies`);

    const allResults: Record<string, SyncResult> = {};

    for (const company of companiesToSync) {
      console.log(`\n--- Syncing company: ${company.name} ---`);

      try {
        // Decrypt credentials
        const { data: apiKey, error: apiKeyError } = await supabase
          .rpc('decrypt_secret', { encrypted: company.campminder_api_key_encrypted });

        const { data: subscriptionKey, error: subKeyError } = await supabase
          .rpc('decrypt_secret', { encrypted: company.campminder_subscription_key_encrypted });

        if (apiKeyError || subKeyError || !apiKey || !subscriptionKey) {
          console.error(`Failed to decrypt credentials for ${company.name}`);
          continue;
        }

        // Get JWT token
        const { token, clientIds } = await getJwtToken(subscriptionKey, apiKey);

        if (clientIds.length === 0) {
          console.error(`No client IDs returned for ${company.name}`);
          continue;
        }

        const clientId = clientIds[0]; // Use first client ID
        const seasonId = season_id || new Date().getFullYear(); // Default to current year

        // Sync all data types
        const divisionResult = await syncDivisions(supabase, token, subscriptionKey, clientId, company.id);
        const camperResult = await syncCampers(supabase, token, subscriptionKey, clientId, company.id, seasonId);
        const staffResult = await syncStaff(supabase, token, subscriptionKey, clientId, company.id, seasonId);
        const sessionResult = await syncSessions(supabase, token, subscriptionKey, clientId, company.id, seasonId);

        allResults[company.name] = {
          campers: camperResult,
          staff: staffResult,
          divisions: divisionResult,
          sessions: sessionResult,
        };

        // Update last sync timestamp
        await supabase
          .from('companies')
          .update({ campminder_last_sync_at: new Date().toISOString() })
          .eq('id', company.id);

      } catch (err) {
        console.error(`Error syncing company ${company.name}:`, err);
        allResults[company.name] = {
          campers: { imported: 0, updated: 0, errors: 1 },
          staff: { imported: 0, updated: 0, errors: 1 },
          divisions: { imported: 0, updated: 0, errors: 1 },
          sessions: { imported: 0, updated: 0, errors: 1 },
        };
      }
    }

    console.log('\n=== CampMinder Sync Complete ===');
    console.log(JSON.stringify(allResults, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        results: allResults,
        companies_synced: companiesToSync.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in CampMinder sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
