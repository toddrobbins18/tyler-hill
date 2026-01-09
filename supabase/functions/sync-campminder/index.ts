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
function normalizeDivisionName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
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
  
  for (const [plural, singular] of Object.entries(pluralMappings)) {
    normalized = normalized.replace(new RegExp(`\\b${plural}\\b`, 'g'), singular);
  }
  
  return normalized;
}

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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function fetchAllPaginated(
  baseUrl: string,
  token: string,
  subscriptionKey: string,
  params: Record<string, string | number | boolean> = {}
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

    if (pageNumber > 50) {
      console.warn('Reached maximum page limit (50)');
      break;
    }
  }

  return allItems;
}

// Fetch a single person by ID with full details
async function fetchPersonById(
  personId: string,
  token: string,
  subscriptionKey: string
): Promise<any | null> {
  try {
    const url = `${CM_PERSONS_URL}/${personId}?includecamperdetails=true&includecontactdetails=true&includerelatives=true&includestaffdetails=true`;
    const response = await rateLimitedFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });
    
    if (response.ok) {
      return await response.json();
    } else {
      console.warn(`[Fetch Person] Failed to fetch person ${personId}: ${response.status}`);
      return null;
    }
  } catch (err) {
    console.error(`[Fetch Person] Error fetching person ${personId}:`, err);
    return null;
  }
}

// Fetch missing persons in batches (for staff/campers not in main persons API response)
async function fetchMissingPersons(
  missingIds: string[],
  personMap: Map<string, any>,
  token: string,
  subscriptionKey: string,
  entityType: string
): Promise<{ fetched: number; failed: number }> {
  let fetched = 0;
  let failed = 0;
  
  console.log(`\n[${entityType}] Fetching ${missingIds.length} missing persons individually...`);
  
  for (let i = 0; i < missingIds.length; i++) {
    const personId = missingIds[i];
    const person = await fetchPersonById(personId, token, subscriptionKey);
    
    if (person && person.Name) {
      personMap.set(personId, person);
      fetched++;
      
      if (fetched <= 5) {
        const name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim();
        console.log(`[${entityType}] Fetched missing person ${personId}: ${name}`);
      }
    } else {
      failed++;
    }
    
    // Progress update every 25 persons
    if ((i + 1) % 25 === 0) {
      console.log(`[${entityType}] Fetch progress: ${i + 1}/${missingIds.length} (${fetched} success, ${failed} failed)`);
    }
  }
  
  console.log(`[${entityType}] Completed fetching missing persons: ${fetched} fetched, ${failed} failed`);
  return { fetched, failed };
}

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

interface ChangeRecord {
  person_id: string;
  name: string;
  changes: { field: string; old_value: any; new_value: any }[];
}

interface UpsertResult {
  inserted: number;
  updated: number;
  errors: string[];
  changes: ChangeRecord[];
}

// Compare two values for equality (handles null, undefined, arrays)
function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a.sort()) === JSON.stringify(b.sort());
  }
  return String(a) === String(b);
}

// Fields to track changes for each table
const TRACKED_FIELDS: Record<string, string[]> = {
  children: ['name', 'gender', 'date_of_birth', 'grade', 'guardian_name', 'guardian_email', 'guardian_phone', 'allergies', 'medical_notes', 'division_id', 'session', 'status'],
  staff: ['name', 'role', 'email', 'phone', 'date_of_birth', 'status', 'budget_code'],
};

async function batchUpsert(
  supabase: any,
  table: string,
  data: any[],
  conflictColumns: string,
  batchSize: number = 100
): Promise<UpsertResult> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];
  const changes: ChangeRecord[] = [];
  const totalBatches = Math.ceil(data.length / batchSize);
  const trackedFields = TRACKED_FIELDS[table] || [];

  // Fetch existing records for comparison
  const personIds = data.map(d => d.person_id).filter(Boolean);
  const companyId = data[0]?.company_id;
  const season = data[0]?.season;
  
  let existingRecordsMap = new Map<string, any>();
  
  if (personIds.length > 0 && companyId && season) {
    console.log(`[${table}] Fetching existing records for change detection...`);
    
    // Fetch in batches of 500 to avoid query limits
    for (let i = 0; i < personIds.length; i += 500) {
      const batchIds = personIds.slice(i, i + 500);
      const { data: existingData, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq('company_id', companyId)
        .eq('season', season)
        .in('person_id', batchIds);
      
      if (fetchError) {
        console.error(`[${table}] Error fetching existing records:`, fetchError.message);
      } else if (existingData) {
        for (const record of existingData) {
          existingRecordsMap.set(record.person_id, record);
        }
      }
    }
    
    console.log(`[${table}] Found ${existingRecordsMap.size} existing records for comparison`);
  }

  const now = new Date().toISOString();

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    // Check each record for changes
    for (const record of batch) {
      const existingRecord = existingRecordsMap.get(record.person_id);
      
      if (existingRecord) {
        // Record exists - check for changes
        const recordChanges: { field: string; old_value: any; new_value: any }[] = [];
        
        for (const field of trackedFields) {
          const oldVal = existingRecord[field];
          const newVal = record[field];
          
          if (!valuesEqual(oldVal, newVal)) {
            recordChanges.push({
              field,
              old_value: oldVal,
              new_value: newVal,
            });
          }
        }
        
        if (recordChanges.length > 0) {
          updated++;
          changes.push({
            person_id: record.person_id,
            name: record.name || existingRecord.name,
            changes: recordChanges,
          });
          
          // Log individual changes
          console.log(`[${table}] UPDATED: ${record.name} (${record.person_id})`);
          for (const change of recordChanges) {
            console.log(`  - ${change.field}: "${change.old_value}" → "${change.new_value}"`);
          }
        }
      } else {
        // New record
        inserted++;
        console.log(`[${table}] NEW: ${record.name} (${record.person_id})`);
      }
    }
    
    // Add updated_at timestamp to all records
    const batchWithTimestamp = batch.map(record => ({
      ...record,
      updated_at: now,
    }));
    
    const { error } = await supabase
      .from(table)
      .upsert(batchWithTimestamp, { onConflict: conflictColumns });
    
    if (error) {
      console.error(`[${table}] Batch ${batchNum}/${totalBatches} error:`, error.message);
      errors.push(`Batch ${batchNum}: ${error.message}`);
    } else {
      console.log(`[${table}] Processed batch ${batchNum}/${totalBatches} (${i + batch.length}/${data.length})`);
    }
  }

  // Summary log
  console.log(`\n[${table}] Change Detection Summary:`);
  console.log(`  - New records: ${inserted}`);
  console.log(`  - Updated records: ${updated}`);
  console.log(`  - Unchanged records: ${data.length - inserted - updated}`);
  if (changes.length > 0) {
    console.log(`  - Total field changes: ${changes.reduce((sum, c) => sum + c.changes.length, 0)}`);
  }

  return { inserted, updated, errors, changes };
}

async function performFullSync(
  supabase: any,
  jobId: string,
  companyId: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  seasonId?: string,
  isIncremental: boolean = false,
  lastSyncAt?: string
): Promise<void> {
  console.log(`\n========================================`);
  console.log(`Starting ${isIncremental ? 'INCREMENTAL' : 'FULL'} sync for company ${companyId}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`[Sync Debug] version=2025-01-09-missing-persons-fix`);
  if (isIncremental && lastSyncAt) {
    console.log(`[Incremental] Last sync: ${lastSyncAt}`);
  }
  console.log(`========================================\n`);
  
  try {
    await updateSyncJob(supabase, jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: { step: 'Starting sync', syncType: isIncremental ? 'incremental' : 'full' },
    });

    const season = '2026';
    console.log(`\n[Season] Using season: ${season}\n`);
    
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Season detected', season, syncType: isIncremental ? 'incremental' : 'full' },
    });

    // 1. Fetch and sync divisions
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

    const divisionIdMap = new Map<string, string>();
    const cmDivisionIdMap = new Map<number, string>();
    
    if (divisions.length > 0) {
      const { data: existingDivisions } = await supabase
        .from('divisions')
        .select('id, name')
        .eq('company_id', companyId);
      
      const existingDivisionMap = new Map(
        existingDivisions?.map((d: any) => [d.name.toLowerCase(), d.id]) || []
      );

      const divisionData = divisions.map((d: any, index: number) => {
        let gender = 'Coed';
        if (d.GenderID === 0) gender = 'Girls';
        else if (d.GenderID === 1) gender = 'Boys';
        
        const name = d.Name;
        const existingId = existingDivisionMap.get(name.toLowerCase());
        
        return {
          id: existingId || undefined,
          name,
          gender,
          sort_order: d.SortOrder ?? index,
          company_id: companyId,
        };
      });
      
      for (const div of divisionData) {
        if (div.id) {
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
      
      const { data: allDivisions } = await supabase
        .from('divisions')
        .select('id, name')
        .eq('company_id', companyId);
      
      const normalizedDivisionMap = new Map<string, string>();
      for (const d of allDivisions || []) {
        const exactKey = d.name.toLowerCase();
        const normalizedKey = normalizeDivisionName(d.name);
        divisionIdMap.set(exactKey, d.id);
        normalizedDivisionMap.set(normalizedKey, d.id);
        console.log(`[Division Map] "${d.name}" -> exact: "${exactKey}", normalized: "${normalizedKey}"`);
      }
      
      let matchedCount = 0;
      let unmatchedDivisions: string[] = [];
      
      for (const d of divisions) {
        const cmName = d.Name;
        const exactKey = cmName.toLowerCase();
        const normalizedKey = normalizeDivisionName(cmName);
        
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

    // 2. Fetch enrolled attendees for filtering (using session attendees for enrollment status)
    console.log('\n--- FETCHING ENROLLED ATTENDEES ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Fetching enrolled attendees', divisions: divisions.length, season },
    });

    const enrolledAttendees = await fetchAllPaginated(
      `${CM_SESSIONS_URL}/attendees`,
      token,
      subscriptionKey,
      { clientid: clientId, seasonid: season, status: 2 }
    );
    console.log(`Found ${enrolledAttendees.length} enrolled attendees`);

    if (enrolledAttendees.length > 0) {
      console.log('[DEBUG] Sample session attendee record:', JSON.stringify(enrolledAttendees[0], null, 2));
    }

    // Build a map of attendee data for fallback (when persons API fails)
    const attendeeDataMap = new Map<string, any>();
    for (const attendee of enrolledAttendees) {
      const personId = String(attendee.PersonID);
      attendeeDataMap.set(personId, {
        PersonID: personId,
        FirstName: attendee.FirstName || attendee.Name?.First || '',
        LastName: attendee.LastName || attendee.Name?.Last || '',
        GenderID: attendee.GenderID,
        DateOfBirth: attendee.DateOfBirth,
        DivisionID: attendee.DivisionID,
        SessionProgramStatus: attendee.SessionProgramStatus,
      });
    }
    console.log(`Built attendee fallback map with ${attendeeDataMap.size} entries`);

    const enrolledPersonIds = new Set(
      enrolledAttendees.map((a: any) => String(a.PersonID))
    );
    const enrolledPersonIdArray = Array.from(enrolledPersonIds);

    // NOTE: We'll use CamperDetails.DivisionID directly from persons API instead of /divisions/attendees
    // The /divisions/attendees endpoint was returning DivisionID: 0 for everyone

    // Fetch sessions for session NAME lookup (used later for session enrollment)
    console.log('\n--- FETCHING SESSIONS FOR NAME LOOKUP ---');
    const sessions = await fetchAllPaginated(
      CM_SESSIONS_URL,
      token,
      subscriptionKey,
      { clientid: clientId, seasonid: season }
    );
    console.log(`Found ${sessions.length} sessions for name lookup`);

    // =====================================================
    // PHASE 3: Fetch ALL persons with V2 API including relatives and contact details
    // This replaces all V1 API calls!
    // =====================================================
    console.log('\n--- FETCHING ALL PERSONS WITH V2 API (includerelatives & includecontactdetails) ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Fetching persons with V2 API', divisions: divisions.length, enrolledAttendees: enrolledAttendees.length, season },
    });
    
    // Use V2 API with includerelatives, includecontactdetails, includecamperdetails, includestaffdetails
    const allPersons = await fetchAllPaginated(
      CM_PERSONS_URL,
      token,
      subscriptionKey,
      { 
        clientid: clientId, 
        includecamperdetails: true,
        includecontactdetails: true,
        includerelatives: true,
        includefamilypersons: true,
        includestaffdetails: true
      }
    );
    
    console.log(`Fetched ${allPersons.length} total persons from V2 API`);
    
    // Debug: Log sample person with relatives
    if (allPersons.length > 0) {
      const sampleWithRelatives = allPersons.find((p: any) => p.Relatives && p.Relatives.length > 0);
      if (sampleWithRelatives) {
        console.log('[DEBUG] Sample person with Relatives:', JSON.stringify({
          ID: sampleWithRelatives.ID,
          Name: sampleWithRelatives.Name,
          Relatives: sampleWithRelatives.Relatives,
          ContactDetails: sampleWithRelatives.ContactDetails
        }, null, 2));
      }
    }

    // Build person lookup map (all persons, not just campers)
    const personMap = new Map<string, any>();
    for (const person of allPersons) {
      personMap.set(String(person.ID), person);
    }
    console.log(`Built person map with ${personMap.size} entries`);

    // =====================================================
    // PHASE 3.5: Fetch staff assignments and identify missing persons
    // =====================================================
    console.log('\n--- FETCHING STAFF ASSIGNMENTS ---');
    
    const currentSeason = season; // 2026
    const fallbackSeason = '2025';
    
    // Try current season first with status=1 (Active/Hired staff only)
    console.log(`[Staff Sync] Trying /staff endpoint with season ${currentSeason}, status=1 (Active)...`);
    let staffAssignments = await fetchAllPaginated(
      CM_STAFF_URL,
      token,
      subscriptionKey,
      { clientid: clientId, seasonid: currentSeason, status: 1 }
    );
    console.log(`Found ${staffAssignments.length} active staff assignments for season ${currentSeason}`);

    // Debug log first staff assignment to see available fields
    if (staffAssignments.length > 0) {
      console.log('[DEBUG] Sample staff assignment with all fields:', JSON.stringify(staffAssignments[0], null, 2));
    }

    // Fallback to previous season if no results
    if (staffAssignments.length === 0) {
      console.log(`[Staff Sync] No staff found for ${currentSeason}, trying ${fallbackSeason} with status=1...`);
      staffAssignments = await fetchAllPaginated(
        CM_STAFF_URL,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: fallbackSeason, status: 1 }
      );
      console.log(`Found ${staffAssignments.length} active staff assignments for season ${fallbackSeason}`);
    }

    // Build a map of staff assignment data for fallback (when persons API fails)
    const staffFallbackMap = new Map<string, any>();
    for (const assignment of staffAssignments) {
      if (assignment.PersonID) {
        const personId = String(assignment.PersonID);
        staffFallbackMap.set(personId, {
          PersonID: personId,
          FirstName: assignment.FirstName || assignment.Name?.First || '',
          LastName: assignment.LastName || assignment.Name?.Last || '',
          Email: assignment.Email || '',
          Phone: assignment.Phone || assignment.PhoneNumber || '',
          Position1ID: assignment.Position1ID,
          PositionID: assignment.PositionID,
          DateOfBirth: assignment.DateOfBirth,
        });
      }
    }
    console.log(`Built staff fallback map with ${staffFallbackMap.size} entries`);

    // Alternative: If /staff endpoint returns nothing, extract staff from persons API
    if (staffAssignments.length === 0) {
      console.log('[Staff Sync] No staff from /staff endpoint. Attempting to find staff from persons API (StaffDetails)...');
      
      const staffFromPersons = allPersons.filter((p: any) => p.StaffDetails);
      console.log(`Found ${staffFromPersons.length} persons with StaffDetails`);
      
      for (const person of staffFromPersons) {
        staffAssignments.push({
          PersonID: person.ID,
          Position1ID: person.StaffDetails?.PositionID || person.StaffDetails?.Position1ID || null,
          PositionID: person.StaffDetails?.PositionID || null,
        });
      }
    }

    // Identify staff PersonIDs that are NOT in personMap
    const staffPersonIds = new Set<string>();
    const staffAssignmentMap = new Map<string, any>();
    const missingStaffIds: string[] = [];
    
    for (const assignment of staffAssignments) {
      if (assignment.PersonID) {
        const personId = String(assignment.PersonID);
        staffPersonIds.add(personId);
        staffAssignmentMap.set(personId, assignment);
        
        if (!personMap.has(personId)) {
          missingStaffIds.push(personId);
        }
      }
    }
    
    console.log(`\n[Staff Analysis]`);
    console.log(`  Total staff PersonIDs: ${staffPersonIds.size}`);
    console.log(`  In personMap: ${staffPersonIds.size - missingStaffIds.length}`);
    console.log(`  MISSING from personMap: ${missingStaffIds.length}`);

    // Identify camper PersonIDs that are NOT in personMap
    const missingCamperIds: string[] = [];
    for (const personId of enrolledPersonIdArray) {
      if (!personMap.has(personId)) {
        missingCamperIds.push(personId);
      }
    }
    
    console.log(`\n[Camper Analysis]`);
    console.log(`  Total enrolled campers: ${enrolledPersonIdArray.length}`);
    console.log(`  In personMap: ${enrolledPersonIdArray.length - missingCamperIds.length}`);
    console.log(`  MISSING from personMap: ${missingCamperIds.length}`);

    // =====================================================
    // PHASE 3.6: Fetch missing persons individually
    // =====================================================
    await updateSyncJob(supabase, jobId, {
      progress: { 
        step: 'Fetching missing persons', 
        missingStaff: missingStaffIds.length,
        missingCampers: missingCamperIds.length,
        season 
      },
    });

    // Fetch missing staff persons
    if (missingStaffIds.length > 0) {
      const staffFetchResult = await fetchMissingPersons(
        missingStaffIds,
        personMap,
        token,
        subscriptionKey,
        'Staff'
      );
      console.log(`[Staff] Recovered ${staffFetchResult.fetched} missing persons`);
    }

    // Fetch missing camper persons
    if (missingCamperIds.length > 0) {
      const camperFetchResult = await fetchMissingPersons(
        missingCamperIds,
        personMap,
        token,
        subscriptionKey,
        'Camper'
      );
      console.log(`[Camper] Recovered ${camperFetchResult.fetched} missing persons`);
    }

    console.log(`\n[Person Map Updated] Now contains ${personMap.size} entries`);

    // Filter to only enrolled campers with CamperDetails
    const campers = allPersons.filter((p: any) => 
      enrolledPersonIds.has(String(p.ID)) && p.CamperDetails
    );
    
    // Also add any missing campers we fetched individually that have CamperDetails
    for (const personId of missingCamperIds) {
      const person = personMap.get(personId);
      if (person && person.CamperDetails && !campers.find((c: any) => String(c.ID) === personId)) {
        campers.push(person);
      }
    }
    
    console.log(`✓ Total campers with CamperDetails: ${campers.length}`);

    // =====================================================
    // PHASE 4: Extract parent info from Relatives array
    // =====================================================
    console.log('\n--- EXTRACTING PARENT INFO FROM RELATIVES ---');
    
    const camperToParentMap = new Map<string, string>(); // camperPersonId -> parentPersonId
    const parentPersonIds = new Set<string>();
    const parentEmailMap = new Map<string, string>();
    const parentPhoneMap = new Map<string, string>();
    const parentNameMap = new Map<string, string>();
    
    let campersWithParents = 0;
    let campersWithoutParents = 0;
    
    for (const camper of campers) {
      const camperId = String(camper.ID);
      const relatives = camper.Relatives || [];
      
      // Find guardian from Relatives array (IsGuardian=true or IsPrimary=true)
      const guardian = relatives.find((r: any) => 
        r.IsGuardian === true || r.IsPrimary === true
      ) || relatives[0]; // Fallback to first relative
      
      if (guardian && guardian.ID) {
        const parentId = String(guardian.ID);
        camperToParentMap.set(camperId, parentId);
        parentPersonIds.add(parentId);
        campersWithParents++;
        
        // Get parent details from personMap (if available)
        const parentPerson = personMap.get(parentId);
        if (parentPerson) {
          // Extract parent name
          const parentName = `${parentPerson.Name?.First || ''} ${parentPerson.Name?.Last || ''}`.trim();
          if (parentName) {
            parentNameMap.set(parentId, parentName);
          }
          
          // Extract parent email from ContactDetails
          if (parentPerson.ContactDetails?.Emails?.length > 0) {
            const loginEmail = parentPerson.ContactDetails.Emails.find((e: any) => e.IsLogin);
            const email = loginEmail?.Address || parentPerson.ContactDetails.Emails[0]?.Address;
            if (email) {
              parentEmailMap.set(parentId, email);
            }
          }
          
          // Extract parent phone from ContactDetails
          if (parentPerson.ContactDetails?.PhoneNumbers?.length > 0) {
            const mobilePhone = parentPerson.ContactDetails.PhoneNumbers.find((p: any) => 
              p.Type === 'Mobile' || p.Type === 'Cell' || p.TypeID === 0 || p.TypeID === 2
            );
            const phone = mobilePhone?.Number || parentPerson.ContactDetails.PhoneNumbers[0]?.Number;
            if (phone) {
              parentPhoneMap.set(parentId, phone);
            }
          }
        }
      } else {
        campersWithoutParents++;
      }
    }
    
    console.log(`\n[Parent Mapping Summary]`);
    console.log(`  Campers with parents found: ${campersWithParents}`);
    console.log(`  Campers without parents: ${campersWithoutParents}`);
    console.log(`  Unique parents: ${parentPersonIds.size}`);
    console.log(`  Parents with emails: ${parentEmailMap.size}`);
    console.log(`  Parents with phones: ${parentPhoneMap.size}`);
    console.log(`  Parents with names: ${parentNameMap.size}`);

    // =====================================================
    // PHASE 5: Fetch missing parent details (parents not in initial fetch OR without email)
    // Parents may be in personMap but have empty ContactDetails in the season query
    // =====================================================
    const parentsWithoutEmail = Array.from(parentPersonIds).filter(id => !parentEmailMap.has(id));
    
    console.log(`\n--- FETCHING PARENT DETAILS FOR ${parentsWithoutEmail.length} PARENTS WITHOUT EMAIL ---`);
    console.log(`  (Parents in personMap but no email: ${parentsWithoutEmail.filter(id => personMap.has(id)).length})`);
    console.log(`  (Parents not in personMap at all: ${parentsWithoutEmail.filter(id => !personMap.has(id)).length})`);
    
    if (parentsWithoutEmail.length > 0) {
      // Batch fetch parents without email
      const parentChunks: string[][] = [];
      for (let i = 0; i < parentsWithoutEmail.length; i += 50) {
        parentChunks.push(parentsWithoutEmail.slice(i, i + 50));
      }
      
      for (const chunk of parentChunks) {
        // Fetch each parent individually since V2 API doesn't support PersonIDs filter
        for (const parentId of chunk) {
          try {
            const url = `${CM_PERSONS_URL}/${parentId}?includecontactdetails=true`;
            const response = await rateLimitedFetch(url, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Ocp-Apim-Subscription-Key': subscriptionKey,
              },
            });
            
            if (response.ok) {
              const parentPerson = await response.json();
              
              // Extract parent name
              const parentName = `${parentPerson.Name?.First || ''} ${parentPerson.Name?.Last || ''}`.trim();
              if (parentName) {
                parentNameMap.set(parentId, parentName);
              }
              
              // Extract parent email
              if (parentPerson.ContactDetails?.Emails?.length > 0) {
                const loginEmail = parentPerson.ContactDetails.Emails.find((e: any) => e.IsLogin);
                const email = loginEmail?.Address || parentPerson.ContactDetails.Emails[0]?.Address;
                if (email) {
                  parentEmailMap.set(parentId, email);
                }
              }
              
              // Extract parent phone
              if (parentPerson.ContactDetails?.PhoneNumbers?.length > 0) {
                const mobilePhone = parentPerson.ContactDetails.PhoneNumbers.find((p: any) => 
                  p.Type === 'Mobile' || p.Type === 'Cell' || p.TypeID === 0 || p.TypeID === 2
                );
                const phone = mobilePhone?.Number || parentPerson.ContactDetails.PhoneNumbers[0]?.Number;
                if (phone) {
                  parentPhoneMap.set(parentId, phone);
                }
              }
              
              console.log(`[Parent Fetch] Got details for parent ${parentId}: name="${parentName}", hasEmail=${!!parentEmailMap.get(parentId)}, hasPhone=${!!parentPhoneMap.get(parentId)}`);
            }
          } catch (err) {
            console.error(`[Parent Fetch] Error fetching parent ${parentId}:`, err);
          }
        }
      }
      
      console.log(`\n[Updated Parent Summary]`);
      console.log(`  Parents with emails: ${parentEmailMap.size}`);
      console.log(`  Parents with phones: ${parentPhoneMap.size}`);
      console.log(`  Parents with names: ${parentNameMap.size}`);
    }

    // =====================================================
    // PHASE 6: Sync campers to database (including fallback for missing persons)
    // =====================================================
    console.log('\n--- SYNCING CAMPERS ---');
    
    // Identify campers that we still don't have in personMap after fetching missing
    const stillMissingCamperIds = missingCamperIds.filter(id => !personMap.has(id));
    console.log(`[Camper Fallback] ${stillMissingCamperIds.length} campers still missing from personMap, will use attendee data`);
    
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Syncing campers', total: campers.length + stillMissingCamperIds.length, divisions: divisions.length, parentEmails: parentEmailMap.size, season },
      total_counts: { divisions: divisions.length, campers: campers.length + stillMissingCamperIds.length },
    });

    // Variables for tracking changes - declared outside if blocks
    let camperChanges: ChangeRecord[] = [];
    let camperInsertedCount = 0;
    let camperUpdatedCount = 0;

    const gradeMap: Record<number, string> = {
      0: 'Pre-K', 1: 'K', 2: '1st', 3: '2nd', 4: '3rd', 5: '4th',
      6: '5th', 7: '6th', 8: '7th', 9: '8th', 10: '9th', 11: '10th', 12: '11th', 13: '12th'
    };

    const camperData: any[] = [];
    let usedCamperFallbackData = 0;

    // Process campers from persons API
    for (const person of campers) {
      const name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim() || 'Unknown';
      
      let gender = null;
      if (person.GenderID === 0) gender = 'Female';
      else if (person.GenderID === 1) gender = 'Male';
      
      const grade = gradeMap[person.CamperDetails?.CampGradeID] || null;
      
      // Get parent contact info
      const parentPersonId = camperToParentMap.get(String(person.ID));
      let guardianEmail = parentPersonId ? parentEmailMap.get(parentPersonId) || '' : '';
      let guardianPhone = parentPersonId ? parentPhoneMap.get(parentPersonId) || '' : '';
      let guardianName = parentPersonId ? parentNameMap.get(parentPersonId) || '' : '';
      
      // Fallback to camper's own contact info if parent not found
      if (!guardianEmail && person.ContactDetails?.Emails?.length > 0) {
        guardianEmail = person.ContactDetails.Emails[0].Address;
      }
      if (!guardianPhone && person.ContactDetails?.PhoneNumbers?.length > 0) {
        guardianPhone = person.ContactDetails.PhoneNumbers[0].Number;
      }

      // Get division directly from CamperDetails.DivisionID (the correct source!)
      const cmDivisionId = person.CamperDetails?.DivisionID;
      const divisionId = cmDivisionId ? cmDivisionIdMap.get(cmDivisionId) : null;
      
      if (!divisionId && cmDivisionId) {
        console.log(`[Division Warning] Camper ${name} has CamperDetails.DivisionID=${cmDivisionId} but no matching division in our DB`);
      }

      camperData.push({
        person_id: String(person.ID),
        name,
        gender,
        date_of_birth: person.DateOfBirth || null,
        grade,
        guardian_name: guardianName || null,
        guardian_email: guardianEmail || null,
        guardian_phone: guardianPhone || null,
        allergies: person.MedicalInfo?.Allergies || null,
        medical_notes: person.MedicalInfo?.Notes || null,
        company_id: companyId,
        season: season,
        status: 'active',
        division_id: divisionId,
      });
    }

    // Add fallback records for campers not in persons API but in attendees
    // Only create records if we have a valid name from the fallback data
    for (const personId of stillMissingCamperIds) {
      const fallbackData = attendeeDataMap.get(personId);
      
      // Only proceed if we have a name from fallback data
      if (!fallbackData || (!fallbackData.FirstName && !fallbackData.LastName)) {
        console.log(`[Camper Skip] No name available for PersonID ${personId} - skipping`);
        continue;
      }
      
      const name = `${fallbackData.FirstName || ''} ${fallbackData.LastName || ''}`.trim();
      if (!name) continue;
      
      let gender = null;
      if (fallbackData.GenderID === 0) gender = 'Female';
      else if (fallbackData.GenderID === 1) gender = 'Male';
      
      // Get division from attendee data if available
      const cmDivisionId = fallbackData.DivisionID;
      const divisionId = cmDivisionId ? cmDivisionIdMap.get(cmDivisionId) : null;
      
      camperData.push({
        person_id: personId,
        name,
        gender,
        date_of_birth: fallbackData.DateOfBirth || null,
        grade: null,
        guardian_name: null,
        guardian_email: null,
        guardian_phone: null,
        allergies: null,
        medical_notes: null,
        company_id: companyId,
        season: season,
        status: 'active',
        division_id: divisionId,
      });
      
      usedCamperFallbackData++;
      if (usedCamperFallbackData <= 5) {
        console.log(`[Camper Fallback] Created record for ${name} (${personId})`);
      }
    }

    console.log(`Built ${camperData.length} camper records (${usedCamperFallbackData} from fallback data)`);
    
    if (camperData.length > 0) {
      // Log sample camper data
      const sampleWithParent = camperData.find(c => c.guardian_email);
      if (sampleWithParent) {
        console.log('[DEBUG] Sample camper with parent email:', JSON.stringify({
          name: sampleWithParent.name,
          guardian_name: sampleWithParent.guardian_name,
          guardian_email: sampleWithParent.guardian_email,
          guardian_phone: sampleWithParent.guardian_phone,
        }, null, 2));
      }
      
      const campersWithEmail = camperData.filter(c => c.guardian_email).length;
      const campersWithPhone = camperData.filter(c => c.guardian_phone).length;
      const campersWithName = camperData.filter(c => c.guardian_name).length;
      console.log(`[Camper Data Summary] ${campersWithEmail} with guardian_email, ${campersWithPhone} with guardian_phone, ${campersWithName} with guardian_name`);

      const camperResult = await batchUpsert(
        supabase,
        'children',
        camperData,
        'company_id,person_id,season'
      );
      console.log(`Synced campers: ${camperResult.inserted} new, ${camperResult.updated} updated`);
      if (camperResult.errors.length) {
        console.error('Camper sync errors:', camperResult.errors);
      }

      // Store camper changes for final summary
      camperChanges = camperResult.changes;
      camperInsertedCount = camperResult.inserted;
      camperUpdatedCount = camperResult.updated;
      console.log(`Synced ${camperResult.inserted + camperResult.updated} campers (${usedCamperFallbackData} from fallback)`);
    }

    // =====================================================
    // PHASE 7: Sync staff with complete person data
    // =====================================================
    console.log('\n--- SYNCING STAFF ---');
    
    // Fetch staff positions for role mapping (works without season)
    const positions = await fetchAllPaginated(
      `${CM_STAFF_URL}/positions`,
      token,
      subscriptionKey,
      { clientid: clientId }
    );
    console.log(`Found ${positions.length} staff positions`);
    
    const positionMap = new Map<number, string>();
    for (const pos of positions) {
      positionMap.set(pos.ID, pos.Name);
    }

    console.log(`Found ${staffPersonIds.size} unique staff person IDs`);

    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Syncing staff', total: staffPersonIds.size, campers: campers.length, divisions: divisions.length, season },
      total_counts: { divisions: divisions.length, campers: campers.length, staff: staffPersonIds.size },
    });

    // Variables for tracking staff changes - declared outside if blocks
    let staffChanges: ChangeRecord[] = [];
    let staffInsertedCount = 0;
    let staffUpdatedCount = 0;
    let usedFallbackData = 0;

    if (staffPersonIds.size > 0) {
      const staffData: any[] = [];
      
      let debugLoggedPerson = false;
      let debugLoggedAssignment = false;
      let skippedNoName = 0;
      
      for (const personId of staffPersonIds) {
        const person = personMap.get(personId);
        const assignment = staffAssignmentMap.get(personId);
        const fallbackData = staffFallbackMap.get(personId);
        
        // DEBUG: Log first person object to see full structure
        if (person && !debugLoggedPerson) {
          console.log('[DEBUG] Sample person object for staff:', JSON.stringify({
            ID: person.ID,
            Name: person.Name,
            StaffDetails: person.StaffDetails,
            topLevelKeys: Object.keys(person)
          }, null, 2));
          debugLoggedPerson = true;
        }
        
        // DEBUG: Log first assignment object to see full structure
        if (assignment && !debugLoggedAssignment) {
          console.log('[DEBUG] Sample assignment object:', JSON.stringify(assignment, null, 2));
          console.log('[DEBUG] All keys in assignment:', Object.keys(assignment).join(', '));
          debugLoggedAssignment = true;
        }
        
        if (!assignment) continue;
        
        // Try to get name from person, or use fallback data from /staff endpoint
        let name = '';
        let email = '';
        let phone = '';
        let dateOfBirth = null;
        let usedFallback = false;
        
        if (person && person.Name) {
          // Person data available from persons API
          name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim();
          dateOfBirth = person.DateOfBirth || null;
          
          if (person.ContactDetails?.Emails?.length > 0) {
            email = person.ContactDetails.Emails[0].Address;
          }
          if (person.ContactDetails?.PhoneNumbers?.length > 0) {
            phone = person.ContactDetails.PhoneNumbers[0].Number;
          }
        } else if (fallbackData && (fallbackData.FirstName || fallbackData.LastName)) {
          // Use fallback data from /staff endpoint
          name = `${fallbackData.FirstName || ''} ${fallbackData.LastName || ''}`.trim();
          email = fallbackData.Email || '';
          phone = fallbackData.Phone || '';
          dateOfBirth = fallbackData.DateOfBirth || null;
          usedFallback = true;
          usedFallbackData++;
        }
        
        // Skip if no valid name - don't create placeholder records
        if (!name || name === 'Unknown' || name.trim() === '') {
          console.log(`[Staff Skip] No name available for PersonID ${personId} - skipping`);
          skippedNoName++;
          continue;
        }
        
        const role = positionMap.get(assignment.Position1ID) || 
                    positionMap.get(assignment.PositionID) || 
                    'Staff';

        staffData.push({
          person_id: personId,
          name,
          role,
          email: email || null,
          phone: phone || null,
          date_of_birth: dateOfBirth,
          company_id: companyId,
          season: season,
          status: 'active',
        });
        
        if (usedFallback && usedFallbackData <= 5) {
          console.log(`[Staff Fallback] Created record for ${name} (${personId}) using /staff endpoint data`);
        }
      }

      console.log(`\n[Staff Build Summary]`);
      console.log(`  Total staff IDs: ${staffPersonIds.size}`);
      console.log(`  Built records: ${staffData.length}`);
      console.log(`  Used fallback data: ${usedFallbackData}`);
      console.log(`  Skipped (no valid name): ${skippedNoName}`);

      if (staffData.length > 0) {
        const staffResult = await batchUpsert(
          supabase,
          'staff',
          staffData,
          'company_id,person_id,season'
        );
        console.log(`Synced staff: ${staffResult.inserted} new, ${staffResult.updated} updated`);
        if (staffResult.errors.length) {
          console.error('Staff sync errors:', staffResult.errors);
        }
        staffChanges = staffResult.changes;
        staffInsertedCount = staffResult.inserted;
        staffUpdatedCount = staffResult.updated;
      }
    } else {
      console.log('[Staff Sync] No staff found from any source. Check if staff data exists in CampMinder for this season.');
    }

    // =====================================================
    // PHASE 8: Sync session enrollments
    // =====================================================
    console.log('\n--- SYNCING SESSIONS ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Syncing sessions', staff: staffPersonIds.size, campers: campers.length, divisions: divisions.length, season },
    });

    try {
      const sessionNameMap = new Map<number, string>();
      for (const session of sessions) {
        sessionNameMap.set(session.ID, session.Name);
      }

      const sessionUpdates: any[] = [];
      for (const attendee of enrolledAttendees) {
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

    // Update company sync timestamp
    await supabase
      .from('companies')
      .update({ campminder_last_sync_at: new Date().toISOString() })
      .eq('id', companyId);

    // Build change summary for the final stats
    const allChanges = [
      ...camperChanges.map(c => ({ ...c, type: 'camper' as const })),
      ...staffChanges.map(c => ({ ...c, type: 'staff' as const })),
    ];

    // Complete the job
    const totalCampersProcessed = camperData.length;
    const finalStats = {
      step: 'Completed',
      syncType: isIncremental ? 'incremental' : 'full',
      divisions: divisions.length,
      campers: totalCampersProcessed,
      campers_from_api: campers.length,
      campers_from_fallback: usedCamperFallbackData,
      campers_inserted: camperInsertedCount,
      campers_updated: camperUpdatedCount,
      staff: staffPersonIds.size,
      staff_synced: staffInsertedCount + staffUpdatedCount,
      staff_inserted: staffInsertedCount,
      staff_updated: staffUpdatedCount,
      parentEmails: parentEmailMap.size,
      parentPhones: parentPhoneMap.size,
      season: season,
      missing_persons_attempted: {
        staff: missingStaffIds.length,
        campers: missingCamperIds.length,
      },
      fallback_data_used: {
        staff: usedFallbackData,
        campers: usedCamperFallbackData,
      },
      changes_summary: allChanges.slice(0, 50), // Limit to first 50 changes to avoid huge payloads
      total_changes: allChanges.length,
    };

    await updateSyncJob(supabase, jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress: finalStats,
      total_counts: { 
        divisions: divisions.length, 
        campers: totalCampersProcessed, 
        staff: staffPersonIds.size,
        staff_synced: staffInsertedCount + staffUpdatedCount,
        campers_inserted: camperInsertedCount,
        campers_updated: camperUpdatedCount,
        staff_inserted: staffInsertedCount,
        staff_updated: staffUpdatedCount,
        fallback_campers: usedCamperFallbackData,
        fallback_staff: usedFallbackData,
      },
    });

    console.log(`\n========================================`);
    console.log(`Sync completed successfully!`);
    console.log(`Sync Type: ${isIncremental ? 'INCREMENTAL' : 'FULL'}`);
    console.log(`Divisions: ${divisions.length}`);
    console.log(`Campers: ${totalCampersProcessed} total (${campers.length} from API, ${usedCamperFallbackData} from fallback)`);
    console.log(`  - Inserted: ${camperInsertedCount}, Updated: ${camperUpdatedCount}`);
    console.log(`Staff: ${staffPersonIds.size} total, ${staffInsertedCount + staffUpdatedCount} synced`);
    console.log(`  - Inserted: ${staffInsertedCount}, Updated: ${staffUpdatedCount}, Fallback: ${usedFallbackData}`);
    console.log(`Parent Emails: ${parentEmailMap.size}`);
    console.log(`Parent Phones: ${parentPhoneMap.size}`);
    console.log(`Total changes detected: ${allChanges.length}`);
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, season_id, incremental } = await req.json().catch(() => ({}));
    
    console.log('Sync request received:', { company_id, season_id, incremental });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        const { token, clientIds } = await getJwtToken(subKeyData, apiKeyData);
        const clientId = clientIds[0];
        
        if (!clientId) {
          throw new Error('No client ID returned from CampMinder');
        }

        // Determine if this should be an incremental sync
        const isIncremental = incremental === true && company.campminder_last_sync_at;
        const lastSyncAt = company.campminder_last_sync_at;

        const { data: job, error: jobError } = await supabase
          .from('sync_jobs')
          .insert({
            company_id: company.id,
            entity_type: 'campminder',
            status: 'pending',
            progress: { step: 'Initializing', syncType: isIncremental ? 'incremental' : 'full' },
            total_counts: {},
          })
          .select()
          .single();

        if (jobError) {
          console.error('Failed to create sync job:', jobError);
          throw new Error('Failed to create sync job');
        }

        console.log(`Created sync job: ${job.id} (${isIncremental ? 'incremental' : 'full'})`);

        EdgeRuntime.waitUntil(
          performFullSync(
            supabase,
            job.id,
            company.id,
            token,
            subKeyData,
            clientId,
            season_id,
            isIncremental,
            lastSyncAt
          )
        );

        results.push({
          company: company.name,
          company_id: company.id,
          status: 'started',
          job_id: job.id,
          sync_type: isIncremental ? 'incremental' : 'full',
          message: `${isIncremental ? 'Incremental' : 'Full'} sync running in background. Check sync_jobs table for progress.`,
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
        note: 'Now fetches missing persons individually to ensure all staff and campers are synced.',
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
