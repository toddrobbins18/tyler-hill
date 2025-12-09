import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CM_AUTH_URL = 'https://api.campminder.com/auth/apikey';
const CM_PERSONS_URL = 'https://api.campminder.com/persons';
const CM_STAFF_URL = 'https://api.campminder.com/staff';
const CM_DIVISIONS_URL = 'https://api.campminder.com/divisions';
const CM_SESSIONS_URL = 'https://api.campminder.com/sessions';
// V1 API endpoint for fetching camper data with DivisionID
const CM_V1_CAMPERS_URL = 'https://webapi.campminder.com/api/entity/person/camper/GetCampers';
// V1 API endpoint for family/guardian data (more reliable than V2 Relatives)
const CM_V1_FAMILY_URL = 'https://webapi.campminder.com/api/entity/family/GetFamilyPersons';
// V1 API endpoint for person data with email addresses
const CM_V1_PERSONS_URL = 'https://webapi.campminder.com/api/entity/person/GetPersons';

// Rate limiting: 250ms between calls (4 calls/sec = 240/min)
const RATE_LIMIT_DELAY_MS = 250;
let lastApiCallTime = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize division names for flexible matching
// Handles: "Freshmen" -> "Freshman", "Cadets" -> "Cadet", etc.
function normalizeDivisionName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Common plural -> singular transformations
  const pluralMappings: Record<string, string> = {
    'freshmen': 'freshman',
    'sophomores': 'sophomore',
    'juniors': 'junior',
    'seniors': 'senior',
    'cadets': 'cadet',
    'pioneers': 'pioneer',
    'rangers': 'ranger',
    'explorers': 'explorer',
    'cubs': 'cub',
    'wolves': 'wolf',
  };
  
  // Apply plural mappings
  for (const [plural, singular] of Object.entries(pluralMappings)) {
    // Replace at word boundary to avoid partial matches
    normalized = normalized.replace(new RegExp(`\\b${plural}\\b`, 'g'), singular);
  }
  
  return normalized;
}

// Declare EdgeRuntime for background task processing
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

interface SyncJob {
  id: string;
  company_id: string;
  status: string;
  progress: Record<string, any>;
  total_counts: Record<string, number>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

// Helper to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate-limited fetch that enforces 250ms between API calls
async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  
  if (timeSinceLastCall < RATE_LIMIT_DELAY_MS && lastApiCallTime > 0) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastCall;
    console.log(`[Rate Limit] Waiting ${waitTime}ms before next API call`);
    await delay(waitTime);
  }
  
  lastApiCallTime = Date.now();
  console.log(`[API] Fetching: ${url.substring(0, 100)}...`);
  return fetch(url, options);
}

// Get JWT token from CampMinder (only called once per sync)
async function getJwtToken(subscriptionKey: string, apiKey: string): Promise<{ token: string; clientIds: string[] }> {
  console.log('Authenticating with CampMinder...');
  
  const authResponse = await rateLimitedFetch(CM_AUTH_URL, {
    method: 'GET',
    headers: {
      'Authorization': apiKey,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  const contentType = authResponse.headers.get('content-type');
  const responseText = await authResponse.text();

  if (!contentType?.includes('application/json')) {
    throw new Error(`CampMinder returned non-JSON response (status ${authResponse.status}): ${responseText.substring(0, 200)}`);
  }

  let authData;
  try {
    authData = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Failed to parse CampMinder response: ${responseText.substring(0, 200)}`);
  }

  if (!authResponse.ok || !authData.Token) {
    throw new Error(`Authentication failed: ${authData.Message || authData.error || JSON.stringify(authData)}`);
  }

  const clientIds = authData.ClientIDs ? String(authData.ClientIDs).split(',').map((id: string) => id.trim()) : [];
  console.log(`Authenticated successfully. ClientIDs: ${clientIds.join(', ')}`);
  
  return { token: authData.Token, clientIds };
}

// Fetch all paginated data from an endpoint with rate limiting
async function fetchAllPaginated(
  baseUrl: string,
  token: string,
  subscriptionKey: string,
  params: Record<string, string | number> = {}
): Promise<any[]> {
  const allItems: any[] = [];
  let pageNumber = 1;
  const pageSize = 500;
  let hasMore = true;

  while (hasMore) {
    const queryParams = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      pagenumber: String(pageNumber),
      pagesize: String(pageSize),
    });

    const url = `${baseUrl}?${queryParams}`;
    
    const response = await rateLimitedFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error for ${baseUrl}: ${response.status} - ${errorText}`);
      break;
    }

    const data = await response.json();
    const items = data.Results || data.data || data.items || data || [];
    
    if (Array.isArray(items)) {
      allItems.push(...items);
      console.log(`Fetched page ${pageNumber}: ${items.length} items (total: ${allItems.length})`);
      
      hasMore = items.length === pageSize;
      pageNumber++;
    } else {
      hasMore = false;
    }

    // Safety limit
    if (pageNumber > 50) {
      console.warn('Reached maximum page limit (50)');
      break;
    }
  }

  return allItems;
}

// Update sync job progress in database
async function updateSyncJob(
  supabase: any,
  jobId: string,
  updates: Partial<SyncJob>
): Promise<void> {
  const { error } = await supabase
    .from('sync_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  
  if (error) {
    console.error('Failed to update sync job:', error);
  }
}

// Batch upsert helper - reduces DB calls dramatically
async function batchUpsert(
  supabase: any,
  table: string,
  data: any[],
  conflictColumns: string,
  batchSize: number = 100
): Promise<{ inserted: number; errors: string[] }> {
  let inserted = 0;
  const errors: string[] = [];
  const totalBatches = Math.ceil(data.length / batchSize);

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictColumns });
    
    if (error) {
      console.error(`[${table}] Batch ${batchNum}/${totalBatches} error:`, error.message);
      errors.push(`Batch ${batchNum}: ${error.message}`);
    } else {
      inserted += batch.length;
      console.log(`[${table}] Processed batch ${batchNum}/${totalBatches} (${inserted}/${data.length})`);
    }
  }

  return { inserted, errors };
}

// Auto-detect active season from CampMinder sessions
async function detectActiveSeason(
  token: string,
  subscriptionKey: string,
  clientId: string
): Promise<string> {
  console.log('Auto-detecting active season from CampMinder...');
  
  try {
    const sessions = await fetchAllPaginated(
      CM_SESSIONS_URL,
      token,
      subscriptionKey,
      { clientid: clientId }
    );
    
    if (!sessions.length) {
      console.log('No sessions found, defaulting to 2025');
      return '2025';
    }
    
    // Find sessions with dates and extract years
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Look for most recent session
    const sessionsWithDates = sessions
      .filter((s: any) => s.StartDate || s.EndDate)
      .map((s: any) => ({
        ...s,
        startDate: new Date(s.StartDate || s.EndDate),
        year: new Date(s.StartDate || s.EndDate).getFullYear(),
      }))
      .filter((s: any) => s.year >= currentYear - 1 && s.year <= currentYear + 1)
      .sort((a: any, b: any) => b.startDate.getTime() - a.startDate.getTime());

    if (sessionsWithDates.length > 0) {
      const latestSession = sessionsWithDates[0];
      console.log(`Detected active season: ${latestSession.year} from session: ${latestSession.Name}`);
      return latestSession.year.toString();
    }
    
    console.log(`No relevant sessions found, defaulting to ${currentYear}`);
    return currentYear.toString();
  } catch (error) {
    console.error('Error detecting season:', error);
    return '2025';
  }
}

// Main sync function that runs in background
async function performFullSync(
  supabase: any,
  jobId: string,
  companyId: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  seasonId?: string
): Promise<void> {
  console.log(`\n========================================`);
  console.log(`Starting full sync for company ${companyId}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`========================================\n`);
  
  try {
    // Update job to running
    await updateSyncJob(supabase, jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: { step: 'Starting sync' },
    });

    // 1. Force 2026 season for now - can be made dynamic later for 2027
    const season = '2026';
    console.log(`\n[Season] Using season: ${season} (hardcoded for now)\n`);
    
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Season detected', season },
    });

    // 2. Fetch and sync divisions
    console.log('\n--- SYNCING DIVISIONS ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Fetching divisions', season },
    });

    const divisions = await fetchAllPaginated(
      CM_DIVISIONS_URL,
      token,
      subscriptionKey,
      { clientid: clientId }
    );
    console.log(`Found ${divisions.length} divisions`);

    // Create division ID mapping (CampMinder ID -> our ID)
    const divisionIdMap = new Map<string, string>();
    // Build CampMinder DivisionID -> Our Division ID mapping (declared here for scope)
    const cmDivisionIdMap = new Map<number, string>();
    
    if (divisions.length > 0) {
      // First, get existing divisions to maintain our IDs
      const { data: existingDivisions } = await supabase
        .from('divisions')
        .select('id, name')
        .eq('company_id', companyId);
      
      const existingDivisionMap = new Map(
        existingDivisions?.map((d: any) => [d.name.toLowerCase(), d.id]) || []
      );

      const divisionData = divisions.map((d: any, index: number) => {
        // Map to standard values that match database constraints
        let gender = 'Coed';
        if (d.GenderID === 0) gender = 'Girls';
        else if (d.GenderID === 1) gender = 'Boys';
        
        const name = d.Name;
        const existingId = existingDivisionMap.get(name.toLowerCase());
        
        return {
          id: existingId || undefined, // Let DB generate if new
          name,
          gender,
          sort_order: d.SortOrder ?? index,
          company_id: companyId,
        };
      });
      
      // Insert new divisions, update existing (but preserve sort_order!)
      for (const div of divisionData) {
        if (div.id) {
          // Only update name and gender, NOT sort_order (preserve user's manual ordering)
          await supabase.from('divisions').update({
            name: div.name,
            gender: div.gender,
          }).eq('id', div.id);
        } else {
          const { data } = await supabase.from('divisions').insert(div).select().single();
          if (data) {
            divisionIdMap.set(div.name.toLowerCase(), data.id);
          }
        }
      }
      
      // Refresh division map with all divisions (store both exact AND normalized names)
      const { data: allDivisions } = await supabase
        .from('divisions')
        .select('id, name')
        .eq('company_id', companyId);
      
      // Create map with both exact lowercase and normalized names for flexible matching
      const normalizedDivisionMap = new Map<string, string>();
      for (const d of allDivisions || []) {
        const exactKey = d.name.toLowerCase();
        const normalizedKey = normalizeDivisionName(d.name);
        divisionIdMap.set(exactKey, d.id);
        normalizedDivisionMap.set(normalizedKey, d.id);
        console.log(`[Division Map] "${d.name}" -> exact: "${exactKey}", normalized: "${normalizedKey}"`);
      }
      
      // Populate CampMinder DivisionID -> Our Division ID mapping with flexible matching
      let matchedCount = 0;
      let unmatchedDivisions: string[] = [];
      
      for (const d of divisions) {
        const cmName = d.Name;
        const exactKey = cmName.toLowerCase();
        const normalizedKey = normalizeDivisionName(cmName);
        
        // Try exact match first, then normalized match
        let ourDivId = divisionIdMap.get(exactKey);
        if (!ourDivId) {
          ourDivId = normalizedDivisionMap.get(normalizedKey);
          if (ourDivId) {
            console.log(`[Division Match] Normalized match: CM "${cmName}" -> normalized "${normalizedKey}" -> matched!`);
          }
        }
        
        if (ourDivId) {
          cmDivisionIdMap.set(d.ID, ourDivId);
          matchedCount++;
        } else {
          unmatchedDivisions.push(`"${cmName}" (ID: ${d.ID})`);
        }
      }
      
      console.log(`\n[Division Mapping Summary]`);
      console.log(`  Total CampMinder divisions: ${divisions.length}`);
      console.log(`  Successfully matched: ${matchedCount}`);
      console.log(`  Our active divisions: ${allDivisions?.length || 0}`);
      
      if (unmatchedDivisions.length > 0) {
        console.log(`  UNMATCHED CampMinder divisions: ${unmatchedDivisions.join(', ')}`);
      }
    }

    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Divisions synced', divisions: divisions.length, season },
      total_counts: { divisions: divisions.length },
    });

    // 3. FIRST: Fetch enrolled attendees to filter campers (status=2 = enrolled)
    console.log('\n--- FETCHING ENROLLED ATTENDEES ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Fetching enrolled attendees', divisions: divisions.length, season },
    });

    const enrolledAttendees = await fetchAllPaginated(
      `${CM_SESSIONS_URL}/attendees`,
      token,
      subscriptionKey,
      { clientid: clientId, seasonid: season, status: 2 }  // status=2 = enrolled
    );
    console.log(`Found ${enrolledAttendees.length} enrolled attendees`);

    // Debug: Log sample attendee structure to understand available fields
    if (enrolledAttendees.length > 0) {
      console.log('[DEBUG] Sample attendee record:', JSON.stringify(enrolledAttendees[0], null, 2));
    }

    // Create set of enrolled person IDs for quick lookup
    const enrolledPersonIds = new Set(
      enrolledAttendees.map((a: any) => String(a.PersonID))
    );

    // Fetch all sessions to get SessionID -> DivisionID mapping
    // (DivisionID is on Session, not on Attendee)
    console.log('\n--- FETCHING SESSIONS FOR DIVISION LOOKUP ---');
    const sessions = await fetchAllPaginated(
      CM_SESSIONS_URL,
      token,
      subscriptionKey,
      { clientid: clientId, seasonid: season }
    );
    console.log(`Found ${sessions.length} sessions for division lookup`);

    // Debug: Log sample session structure
    if (sessions.length > 0) {
      console.log('[DEBUG] Sample session record:', JSON.stringify(sessions[0], null, 2));
    }

    // Build SessionID -> DivisionID map
    const sessionDivisionMap = new Map<number, number>();
    for (const session of sessions) {
      if (session.ID && session.DivisionID) {
        sessionDivisionMap.set(session.ID, session.DivisionID);
      }
    }
    console.log(`Built session->division map with ${sessionDivisionMap.size} entries`);

    // Create PersonID -> Our Division ID mapping from enrolled attendees
    const personDivisionMap = new Map<string, string>();
    let mappedToDivision = 0;
    let unmappedToDivision = 0;
    const unmappedDivisionIds = new Set<number>();
    
    for (const attendee of enrolledAttendees) {
      // Try direct DivisionID first, then fall back to session-based lookup
      const cmDivisionId = attendee.DivisionID || sessionDivisionMap.get(attendee.SessionID);
      const ourDivId = cmDivisionIdMap.get(cmDivisionId);
      
      if (ourDivId) {
        personDivisionMap.set(String(attendee.PersonID), ourDivId);
        mappedToDivision++;
      } else {
        unmappedToDivision++;
        if (cmDivisionId) {
          unmappedDivisionIds.add(cmDivisionId);
        }
      }
    }
    
    console.log(`\n[Camper Division Mapping Summary]`);
    console.log(`  Total enrolled attendees: ${enrolledAttendees.length}`);
    console.log(`  Mapped to divisions: ${mappedToDivision}`);
    console.log(`  NOT mapped (division not found): ${unmappedToDivision}`);
    
    if (unmappedDivisionIds.size > 0) {
      console.log(`  Unmatched CampMinder Division IDs: ${Array.from(unmappedDivisionIds).join(', ')}`);
    }

    // 4. Fetch ALL persons with contact details
    console.log('\n--- FETCHING ALL PERSONS ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Fetching persons', divisions: divisions.length, enrolledAttendees: enrolledAttendees.length, season },
    });

    const allPersons = await fetchAllPaginated(
      CM_PERSONS_URL,
      token,
      subscriptionKey,
      { 
        clientid: clientId,
        seasonid: season,
        includecamperdetails: 'true',
        includecontactdetails: 'true',
        includerelatives: 'true',  // Required for parent/guardian email data
      }
    );
    console.log(`Found ${allPersons.length} total persons`);

    // Filter to ONLY enrolled campers (not all 25,000+ persons with CamperDetails)
    const campers = allPersons.filter((p: any) => 
      p.CamperDetails && enrolledPersonIds.has(String(p.ID))
    );
    const nonCampers = allPersons.filter((p: any) => !p.CamperDetails);
    
    const totalWithCamperDetails = allPersons.filter((p: any) => p.CamperDetails).length;
    console.log(`Filtered to ${campers.length} ENROLLED campers (from ${totalWithCamperDetails} total with CamperDetails)`);

    // 4. Sync campers with batch upsert
    console.log('\n--- SYNCING CAMPERS ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Syncing campers', total: campers.length, divisions: divisions.length, season },
      total_counts: { divisions: divisions.length, campers: campers.length },
    });

    // Fetch division data from V1 API (has DivisionID at camper level)
    console.log('\n--- FETCHING V1 CAMPER DATA FOR DIVISIONS ---');
    const v1DivisionMap = new Map<string, number>();
    
    if (campers.length > 0) {
      try {
        // Build PersonIDs list for V1 API call (batch in chunks of 100 to avoid URL length issues)
        const personIdChunks: string[][] = [];
        const allPersonIds = campers.map((p: any) => String(p.ID));
        for (let i = 0; i < allPersonIds.length; i += 100) {
          personIdChunks.push(allPersonIds.slice(i, i + 100));
        }
        
        console.log(`Fetching V1 camper data in ${personIdChunks.length} batch(es)...`);
        
        for (const chunk of personIdChunks) {
          const v1Url = `${CM_V1_CAMPERS_URL}?SeasonID=${season}&PersonIDs=${chunk.join(',')}`;
          console.log(`[V1 API] Calling: ${v1Url.substring(0, 120)}...`);
          
          const v1Response = await rateLimitedFetch(v1Url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Ocp-Apim-Subscription-Key': subscriptionKey,
              'Content-Type': 'application/json',
            },
          });
          
          if (v1Response.ok) {
            const v1Data = await v1Response.json();
            const v1Campers = v1Data?.Result || v1Data || [];
            console.log(`[V1 API] Received ${Array.isArray(v1Campers) ? v1Campers.length : 0} campers`);
            
            // Debug: Log first camper to see structure
            if (Array.isArray(v1Campers) && v1Campers.length > 0) {
              console.log('[DEBUG] Sample V1 Camper:', JSON.stringify(v1Campers[0], null, 2));
              
              for (const camper of v1Campers) {
                if (camper.PersonID && camper.DivisionID) {
                  v1DivisionMap.set(String(camper.PersonID), camper.DivisionID);
                }
              }
            }
          } else {
            const errorText = await v1Response.text();
            console.error(`[V1 API] Error ${v1Response.status}: ${errorText.substring(0, 200)}`);
          }
        }
        
        console.log(`[V1 API] Built division map with ${v1DivisionMap.size} entries`);
      } catch (v1Error) {
        console.error('[V1 API] Failed to fetch camper divisions:', v1Error);
      }
    }

    // Step 1: Use V1 Family API to get parent/guardian PersonIDs
    // API returns: FamilyID, PersonID, RoleID (1=Parent1, 2=Parent2, 3=PrimaryFamilyChild, 4=SecondaryFamilyChild)
    console.log('\n--- FETCHING PARENT EMAILS VIA V1 FAMILY API ---');
    const parentPersonIds = new Set<string>();
    const camperToParentMap = new Map<string, string>(); // camperPersonId -> parentPersonId
    
    // Batch fetch family data using V1 API
    const camperPersonIdArray = campers.map((c: any) => String(c.ID));
    const familyChunks: string[][] = [];
    for (let i = 0; i < camperPersonIdArray.length; i += 50) {
      familyChunks.push(camperPersonIdArray.slice(i, i + 50));
    }
    
    console.log(`Fetching family data for ${camperPersonIdArray.length} campers in ${familyChunks.length} batch(es)...`);
    
    // Group all family records by FamilyID to map campers to parents
    const familyGroups = new Map<number, { parents: string[], children: string[] }>();
    const camperPersonIdSet = new Set(camperPersonIdArray);
    
    for (const chunk of familyChunks) {
      try {
        // Include Roles filter: 1,2 = parents, 3,4 = children
        const familyUrl = `${CM_V1_FAMILY_URL}?PersonIDs=${chunk.join(',')}`;
        console.log(`[V1 Family API] Fetching family for ${chunk.length} campers...`);
        
        const familyResponse = await rateLimitedFetch(familyUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'application/json',
          },
        });
        
        if (familyResponse.ok) {
          const familyData = await familyResponse.json();
          const familyResults = familyData?.Result || familyData || [];
          console.log(`[V1 Family API] Received ${Array.isArray(familyResults) ? familyResults.length : 0} family records`);
          
          // Debug: Log first 3 family records to understand structure
          if (Array.isArray(familyResults) && familyResults.length > 0) {
            console.log('[DEBUG] Sample V1 Family Records (first 3):');
            familyResults.slice(0, 3).forEach((r: any, i: number) => {
              console.log(`  [${i}] FamilyID=${r.FamilyID}, PersonID=${r.PersonID}, RoleID=${r.RoleID}, Role=${r.Role}`);
            });
          }
          
          if (Array.isArray(familyResults)) {
            // Group by FamilyID
            for (const record of familyResults) {
              const familyId = record.FamilyID;
              const personId = String(record.PersonID);
              const roleId = record.RoleID || record.Role;
              
              if (!familyGroups.has(familyId)) {
                familyGroups.set(familyId, { parents: [], children: [] });
              }
              
              const group = familyGroups.get(familyId)!;
              
              // RoleID: 1=Parent1, 2=Parent2, 3=PrimaryFamilyChild, 4=SecondaryFamilyChild
              if (roleId === 1 || roleId === 2) {
                if (!group.parents.includes(personId)) {
                  group.parents.push(personId);
                }
              } else if (roleId === 3 || roleId === 4) {
                if (!group.children.includes(personId)) {
                  group.children.push(personId);
                }
              }
            }
          }
        } else {
          const errorText = await familyResponse.text();
          console.error(`[V1 Family API] Error ${familyResponse.status}: ${errorText.substring(0, 300)}`);
        }
      } catch (err) {
        console.error('[V1 Family API] Error fetching family batch:', err);
      }
    }
    
    console.log(`[V1 Family API] Found ${familyGroups.size} family groups`);
    
    // Now map each camper to their parent(s) via FamilyID grouping
    for (const [familyId, group] of familyGroups) {
      // Find children that are our enrolled campers
      const enrolledChildren = group.children.filter(childId => camperPersonIdSet.has(childId));
      
      // Get first parent (prioritize Parent1)
      const primaryParent = group.parents[0];
      
      if (primaryParent && enrolledChildren.length > 0) {
        parentPersonIds.add(primaryParent);
        for (const childId of enrolledChildren) {
          camperToParentMap.set(childId, primaryParent);
        }
      }
    }
    
    console.log(`[V1 Family API] Mapped ${camperToParentMap.size} campers to ${parentPersonIds.size} unique parents`);

    // Step 2: Fetch parent contact info using V1 GetPersons API (returns EmailAddresses and PhoneNumbers)
    const parentEmailMap = new Map<string, string>(); // parentPersonId -> email
    const parentPhoneMap = new Map<string, string>(); // parentPersonId -> phone
    
    if (parentPersonIds.size > 0) {
      const parentIdArray = Array.from(parentPersonIds);
      const parentChunks: string[][] = [];
      for (let i = 0; i < parentIdArray.length; i += 50) {
        parentChunks.push(parentIdArray.slice(i, i + 50));
      }
      
      console.log(`Fetching parent contact info in ${parentChunks.length} batch(es) using V1 GetPersons API...`);
      
      for (const chunk of parentChunks) {
        try {
          // Use V1 GetPersons endpoint which returns EmailAddresses and PhoneNumbers
          const personsUrl = `${CM_V1_PERSONS_URL}?PersonIDs=${chunk.join(',')}`;
          console.log(`[V1 Persons API] Fetching contact info for ${chunk.length} parents...`);
          
          const personsResponse = await rateLimitedFetch(personsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Ocp-Apim-Subscription-Key': subscriptionKey,
              'Content-Type': 'application/json',
            },
          });
          
          if (personsResponse.ok) {
            const personsData = await personsResponse.json();
            const personResults = personsData?.Result || personsData || [];
            console.log(`[V1 Persons API] Received ${Array.isArray(personResults) ? personResults.length : 0} person records`);
            
            // Debug: Log sample person record with email structure
            if (Array.isArray(personResults) && personResults.length > 0) {
              const sample = personResults[0];
              console.log('[DEBUG] Sample V1 Person Record:');
              console.log(`  ID=${sample.ID}, Name=${sample.Name?.FirstName} ${sample.Name?.LastName}`);
              console.log(`  EmailAddresses: ${JSON.stringify(sample.EmailAddresses || [])}`);
              console.log(`  PhoneNumbers: ${JSON.stringify(sample.PhoneNumbers || [])}`);
            }
            
            if (Array.isArray(personResults)) {
              for (const person of personResults) {
                const personId = String(person.ID);
                
                // Extract email (prioritize login email)
                if (person.EmailAddresses && Array.isArray(person.EmailAddresses) && person.EmailAddresses.length > 0) {
                  const loginEmail = person.EmailAddresses.find((e: any) => e.IsLoginEmail);
                  const email = loginEmail?.Email || person.EmailAddresses[0]?.Email;
                  if (email) {
                    parentEmailMap.set(personId, email);
                  }
                }
                
                // Extract phone
                if (person.PhoneNumbers && Array.isArray(person.PhoneNumbers) && person.PhoneNumbers.length > 0) {
                  const phone = person.PhoneNumbers[0]?.Number;
                  if (phone) {
                    parentPhoneMap.set(personId, phone);
                  }
                }
              }
            }
          } else {
            const errorText = await personsResponse.text();
            console.error(`[V1 Persons API] Error ${personsResponse.status}: ${errorText.substring(0, 200)}`);
            
            // Fallback to V2 API if V1 fails
            console.log('[Fallback] Trying V2 API for parent contact details...');
            const parentUrl = `${CM_PERSONS_URL}?clientId=${clientId}&seasonID=${season}&personIDs=${chunk.join(',')}&includecontactdetails=true`;
            
            const parentResponse = await rateLimitedFetch(parentUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Ocp-Apim-Subscription-Key': subscriptionKey,
              },
            });
            
            if (parentResponse.ok) {
              const parentData = await parentResponse.json();
              const parents = parentData?.Results || parentData?.Value || parentData || [];
              
              if (Array.isArray(parents)) {
                for (const parent of parents) {
                  const parentId = String(parent.ID);
                  if (parent.ContactDetails?.Emails?.length > 0) {
                    const loginEmail = parent.ContactDetails.Emails.find((e: any) => e.IsLogin);
                    const email = loginEmail?.Address || parent.ContactDetails.Emails[0]?.Address;
                    if (email) parentEmailMap.set(parentId, email);
                  }
                  if (parent.ContactDetails?.PhoneNumbers?.length > 0) {
                    parentPhoneMap.set(parentId, parent.ContactDetails.PhoneNumbers[0].Number);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('[V1 Persons API] Error fetching parent batch:', err);
        }
      }
      
      console.log(`[Parent Emails] Retrieved ${parentEmailMap.size} parent emails, ${parentPhoneMap.size} parent phones`);
    }

    if (campers.length > 0) {
      // Map grade IDs to names
      const gradeMap: Record<number, string> = {
        0: 'Pre-K', 1: 'K', 2: '1st', 3: '2nd', 4: '3rd', 5: '4th',
        6: '5th', 7: '6th', 8: '7th', 9: '8th', 10: '9th', 11: '10th', 12: '11th', 13: '12th'
      };

      const camperData = campers.map((person: any) => {
        const name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim() || 'Unknown';
        
        // Map gender
        let gender = null;
        if (person.GenderID === 0) gender = 'Female';
        else if (person.GenderID === 1) gender = 'Male';
        
        // Get grade
        const grade = gradeMap[person.CamperDetails?.CampGradeID] || null;
        
        // Get parent contact info (Step 3 & 4: Map parent emails to campers)
        const parentPersonId = camperToParentMap.get(String(person.ID));
        let guardianEmail = parentPersonId ? parentEmailMap.get(parentPersonId) || '' : '';
        let guardianPhone = parentPersonId ? parentPhoneMap.get(parentPersonId) || '' : '';
        
        // Fallback to camper's own contact info if parent not found
        if (!guardianEmail && person.ContactDetails?.Emails?.length > 0) {
          guardianEmail = person.ContactDetails.Emails[0].Address;
        }
        if (!guardianPhone && person.ContactDetails?.PhoneNumbers?.length > 0) {
          guardianPhone = person.ContactDetails.PhoneNumbers[0].Number;
        }

        // Get division - Priority: 1) V1 API, 2) CamperDetails, 3) Session-based (personDivisionMap)
        const v1DivId = v1DivisionMap.get(String(person.ID));
        const v2DivId = person.CamperDetails?.DivisionID;
        const sessionDivId = personDivisionMap.get(String(person.ID)); // Already contains our UUID!

        let divisionId: string | null = null;
        let divisionSource = 'none';
        
        if (v1DivId) {
          divisionId = cmDivisionIdMap.get(v1DivId) || null;
          divisionSource = 'V1 API';
        } else if (v2DivId) {
          divisionId = cmDivisionIdMap.get(v2DivId) || null;
          divisionSource = 'CamperDetails';
        } else if (sessionDivId) {
          // personDivisionMap already contains our division UUID from session mapping
          divisionId = sessionDivId;
          divisionSource = 'Session';
        }

        return {
          person_id: String(person.ID),
          name,
          gender,
          date_of_birth: person.DateOfBirth || null,
          grade,
          guardian_email: guardianEmail || null,
          guardian_phone: guardianPhone || null,
          allergies: person.MedicalInfo?.Allergies || null,
          medical_notes: person.MedicalInfo?.Notes || null,
          company_id: companyId,
          season: season,
          status: 'active',
          division_id: divisionId,
        };
      });

      // Log division mapping results
      const mappedCount = camperData.filter(c => c.division_id).length;
      console.log(`[Division Mapping] ${mappedCount}/${camperData.length} campers mapped to divisions`);

      const { inserted: camperInserted, errors: camperErrors } = await batchUpsert(
        supabase,
        'children',
        camperData,
        'company_id,person_id,season'
      );
      console.log(`Synced ${camperInserted} campers`);
      if (camperErrors.length) {
        console.error('Camper sync errors:', camperErrors);
      }
    }

    // 5. Fetch staff assignments and positions (only 2-3 API calls total)
    console.log('\n--- SYNCING STAFF ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Fetching staff data', campers: campers.length, divisions: divisions.length, season },
    });

    // Fetch positions for role mapping
    let positionMap = new Map<number, string>();
    try {
      const positions = await fetchAllPaginated(
        `${CM_STAFF_URL}/positions`,
        token,
        subscriptionKey,
        { clientid: clientId }
      );
      positionMap = new Map(positions.map((p: any) => [p.ID, p.Name]));
      console.log(`Found ${positions.length} staff positions`);
    } catch (error) {
      console.log('Staff positions endpoint not available');
    }

    // Fetch staff assignments
    let staffAssignments: any[] = [];
    try {
      staffAssignments = await fetchAllPaginated(
        CM_STAFF_URL,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: season, status: 1 }
      );
      console.log(`Found ${staffAssignments.length} staff assignments`);
    } catch (error) {
      console.log('Staff assignments endpoint not available');
    }

    // Create a map of person ID to staff assignment
    const staffAssignmentMap = new Map<string, any>();
    for (const assignment of staffAssignments) {
      staffAssignmentMap.set(String(assignment.PersonID), assignment);
    }

    // Create person lookup from all persons we already fetched (NO additional API calls!)
    const personMap = new Map<string, any>();
    for (const person of allPersons) {
      personMap.set(String(person.ID), person);
    }

    // Build staff data
    const staffPersonIds = new Set([
      ...staffAssignments.map((a: any) => String(a.PersonID)),
    ]);

    console.log(`Building data for ${staffPersonIds.size} staff members`);

    // Fetch missing staff person data (those not in allPersons)
    const missingPersonIds = [...staffPersonIds].filter(id => !personMap.has(id));
    console.log(`Found ${missingPersonIds.length} staff persons not in initial fetch, fetching individually...`);

    if (missingPersonIds.length > 0) {
      for (const personId of missingPersonIds) {
        try {
          const personResponse = await rateLimitedFetch(
            `${CM_PERSONS_URL}/${personId}?clientid=${clientId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Ocp-Apim-Subscription-Key': subscriptionKey,
              },
            }
          );
          if (personResponse.ok) {
            const person = await personResponse.json();
            personMap.set(String(person.ID), person);
            console.log(`Fetched missing person ${personId}: ${person.Name?.First} ${person.Name?.Last}`);
          }
        } catch (e) {
          console.log(`Could not fetch person ${personId}:`, e);
        }
      }
    }

    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Syncing staff', total: staffPersonIds.size, campers: campers.length, divisions: divisions.length, season },
      total_counts: { divisions: divisions.length, campers: campers.length, staff: staffPersonIds.size },
    });

    if (staffPersonIds.size > 0) {
      const staffData: any[] = [];
      
      for (const personId of staffPersonIds) {
        const person = personMap.get(personId);
        const assignment = staffAssignmentMap.get(personId);
        
        if (!assignment) continue;
        
        const name = person 
          ? `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim()
          : '';
        
        // Skip staff without valid names
        if (!name || name === 'Unknown' || name.trim() === '') {
          console.log(`Skipping staff ${personId} - no valid name`);
          continue;
        }
        
        // Get role from position map
        const role = positionMap.get(assignment.Position1ID) || 
                    positionMap.get(assignment.PositionID) || 
                    'Staff';
        
        // Get contact info from person data we already have
        let email = '';
        let phone = '';
        if (person?.ContactDetails?.Emails?.length > 0) {
          email = person.ContactDetails.Emails[0].Address;
        }
        if (person?.ContactDetails?.PhoneNumbers?.length > 0) {
          phone = person.ContactDetails.PhoneNumbers[0].Number;
        }

        staffData.push({
          person_id: personId,
          name,
          role,
          email: email || null,
          phone: phone || null,
          date_of_birth: person?.DateOfBirth || null,
          company_id: companyId,
          season: season,
          status: 'active',
        });
      }

      console.log(`Built ${staffData.length} staff records with valid names (skipped ${staffPersonIds.size - staffData.length} without names)`);

      if (staffData.length > 0) {
        const { inserted: staffInserted, errors: staffErrors } = await batchUpsert(
          supabase,
          'staff',
          staffData,
          'company_id,person_id,season'
        );
        console.log(`Synced ${staffInserted} staff`);
        if (staffErrors.length) {
          console.error('Staff sync errors:', staffErrors);
        }
      }
    }

    // 6. Update session enrollment for campers
    console.log('\n--- SYNCING SESSIONS ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Syncing sessions', staff: staffPersonIds.size, campers: campers.length, divisions: divisions.length, season },
    });

    try {
      const sessions = await fetchAllPaginated(
        CM_SESSIONS_URL,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: season }
      );
      console.log(`Found ${sessions.length} sessions`);

      // Create session name map
      const sessionNameMap = new Map<number, string>();
      for (const session of sessions) {
        sessionNameMap.set(session.ID, session.Name);
      }

      // Fetch attendees
      const attendees = await fetchAllPaginated(
        `${CM_SESSIONS_URL}/attendees`,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: season, status: 2 }
      );
      console.log(`Found ${attendees.length} enrolled attendees`);

      // Update camper session info in batches
      const sessionUpdates: any[] = [];
      for (const attendee of attendees) {
        const sessionPrograms = attendee.SessionProgramStatus || [];
        const enrolledSessions = sessionPrograms
          .filter((s: any) => s.StatusID === 2)
          .map((s: any) => sessionNameMap.get(s.SessionID) || `Session ${s.SessionID}`)
          .join(', ');
        
        if (enrolledSessions) {
          sessionUpdates.push({
            person_id: String(attendee.PersonID),
            session: enrolledSessions,
          });
        }
      }

      // Batch update sessions
      for (let i = 0; i < sessionUpdates.length; i += 100) {
        const batch = sessionUpdates.slice(i, i + 100);
        for (const update of batch) {
          await supabase
            .from('children')
            .update({ session: update.session })
            .eq('company_id', companyId)
            .eq('person_id', update.person_id)
            .eq('season', season);
        }
        console.log(`Updated sessions for batch ${Math.floor(i / 100) + 1}/${Math.ceil(sessionUpdates.length / 100)}`);
      }
      
      console.log(`Updated session info for ${sessionUpdates.length} campers`);
    } catch (error) {
      console.error('Error syncing sessions:', error);
    }

    // 7. Update company sync timestamp
    await supabase
      .from('companies')
      .update({ campminder_last_sync_at: new Date().toISOString() })
      .eq('id', companyId);

    // 8. Complete the job
    const finalStats = {
      step: 'Completed',
      divisions: divisions.length,
      campers: campers.length,
      staff: staffPersonIds.size,
      season: season,
    };

    await updateSyncJob(supabase, jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: finalStats,
      total_counts: { divisions: divisions.length, campers: campers.length, staff: staffPersonIds.size },
    });

    console.log(`\n========================================`);
    console.log(`Sync completed successfully!`);
    console.log(`Divisions: ${divisions.length}`);
    console.log(`Campers: ${campers.length}`);
    console.log(`Staff: ${staffPersonIds.size}`);
    console.log(`Season: ${season}`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('Sync failed:', error);
    
    await updateSyncJob(supabase, jobId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : 'Unknown error',
      progress: { step: 'Failed', error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, season_id } = await req.json().catch(() => ({}));
    
    console.log('Sync request received:', { company_id, season_id });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch company with CampMinder credentials
    let companiesQuery = supabase
      .from('companies')
      .select('*')
      .eq('campminder_sync_enabled', true);
    
    if (company_id) {
      companiesQuery = companiesQuery.eq('id', company_id);
    }

    const { data: companies, error: companyError } = await companiesQuery;

    if (companyError) {
      throw new Error(`Failed to fetch companies: ${companyError.message}`);
    }

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No companies with CampMinder sync enabled' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];

    for (const company of companies) {
      console.log(`Processing company: ${company.name}`);
      
      // Decrypt credentials - parameter name must match the function signature
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .rpc('decrypt_secret', { encrypted: company.campminder_api_key_encrypted });
      
      const { data: subKeyData, error: subKeyError } = await supabase
        .rpc('decrypt_secret', { encrypted: company.campminder_subscription_key_encrypted });

      if (apiKeyError || subKeyError) {
        console.error('Failed to decrypt credentials for company:', company.name, { apiKeyError, subKeyError });
        results.push({ company: company.name, status: 'error', message: 'Failed to decrypt credentials' });
        continue;
      }
      
      if (!apiKeyData || !subKeyData) {
        console.error('Empty credentials for company:', company.name);
        results.push({ company: company.name, status: 'error', message: 'Credentials not configured' });
        continue;
      }

      try {
        // Authenticate with CampMinder (only 1 auth call!)
        const { token, clientIds } = await getJwtToken(subKeyData, apiKeyData);
        const clientId = clientIds[0];
        
        if (!clientId) {
          throw new Error('No client ID returned from CampMinder');
        }

        // Create a sync job record
        const { data: job, error: jobError } = await supabase
          .from('sync_jobs')
          .insert({
            company_id: company.id,
            entity_type: 'campminder',
            status: 'pending',
            progress: { step: 'Initializing' },
            total_counts: {},
          })
          .select()
          .single();

        if (jobError) {
          console.error('Failed to create sync job:', jobError);
          throw new Error('Failed to create sync job');
        }

        console.log(`Created sync job: ${job.id}`);

        // Start background sync using EdgeRuntime.waitUntil
        // This allows the function to return immediately while sync continues
        EdgeRuntime.waitUntil(
          performFullSync(
            supabase,
            job.id,
            company.id,
            token,
            subKeyData,
            clientId,
            season_id
          )
        );

        results.push({
          company: company.name,
          company_id: company.id,
          status: 'started',
          job_id: job.id,
          message: 'Sync running in background. Check sync_jobs table for progress.',
        });

      } catch (authError) {
        console.error(`Auth error for ${company.name}:`, authError);
        results.push({
          company: company.name,
          status: 'error',
          message: authError instanceof Error ? authError.message : 'Authentication failed',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync jobs started in background',
        results,
        note: 'API calls are rate-limited to 4/second (240/min). Large syncs may take a few minutes.',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
