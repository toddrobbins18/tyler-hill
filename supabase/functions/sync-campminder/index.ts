import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CM_AUTH_URL = 'https://api.campminder.com/auth/apikey';
const CM_PERSONS_URL = 'https://api.campminder.com/persons';
const CM_STAFF_URL = 'https://api.campminder.com/staff';
const CM_DIVISIONS_URL = 'https://api.campminder.com/divisions';
const CM_SESSIONS_URL = 'https://api.campminder.com/sessions';

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

    // Create set of enrolled person IDs for quick lookup
    const enrolledPersonIds = new Set(
      enrolledAttendees.map((a: any) => String(a.PersonID))
    );

    // Create PersonID -> Our Division ID mapping from enrolled attendees
    const personDivisionMap = new Map<string, string>();
    let mappedToDivision = 0;
    let unmappedToDivision = 0;
    const unmappedDivisionIds = new Set<number>();
    
    for (const attendee of enrolledAttendees) {
      const ourDivId = cmDivisionIdMap.get(attendee.DivisionID);
      if (ourDivId) {
        personDivisionMap.set(String(attendee.PersonID), ourDivId);
        mappedToDivision++;
      } else {
        unmappedToDivision++;
        unmappedDivisionIds.add(attendee.DivisionID);
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
        
        // Get contact info
        let guardianEmail = '';
        let guardianPhone = '';
        if (person.ContactDetails?.Emails?.length > 0) {
          guardianEmail = person.ContactDetails.Emails[0].Address;
        }
        if (person.ContactDetails?.PhoneNumbers?.length > 0) {
          guardianPhone = person.ContactDetails.PhoneNumbers[0].Number;
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
          division_id: personDivisionMap.get(String(person.ID)) || null,
        };
      });

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
