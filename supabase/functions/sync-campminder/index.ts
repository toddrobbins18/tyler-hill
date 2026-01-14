import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CM_AUTH_URL = 'https://api.campminder.com/auth/apikey';
const CM_PERSONS_URL = 'https://api.campminder.com/persons';
const CM_STAFF_URL = 'https://api.campminder.com/staff';
const CM_DIVISIONS_URL = 'https://api.campminder.com/divisions';
const CM_SESSIONS_URL = 'https://api.campminder.com/sessions';


// Rate limiting: 300ms between calls (~3.3 calls/sec = ~200/min)
// CampMinder enforces strict rate limits - 429 errors occur at higher rates
const RATE_LIMIT_DELAY_MS = 300;
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

// Robust name extraction from any CampMinder record format
function extractName(record: any): { firstName: string; lastName: string } {
  let firstName = '';
  let lastName = '';

  // Try direct fields first (most common)
  firstName = (record?.FirstName || record?.firstName || '').toString().trim();
  lastName = (record?.LastName || record?.lastName || '').toString().trim();

  // Try nested Name object
  if ((!firstName || !lastName) && record?.Name) {
    if (typeof record.Name === 'string') {
      // Name is a full string like "John Smith"
      const parts = record.Name.trim().split(/\s+/);
      if (parts.length >= 2) {
        firstName = firstName || parts[0];
        lastName = lastName || parts.slice(1).join(' ');
      } else if (parts.length === 1) {
        firstName = firstName || parts[0];
      }
    } else if (typeof record.Name === 'object') {
      // Name is an object like { First: "John", Last: "Smith" }
      firstName = firstName || (record.Name.First || record.Name.first || '').toString().trim();
      lastName = lastName || (record.Name.Last || record.Name.last || '').toString().trim();
      
      // Also check Full inside Name object
      if ((!firstName || !lastName) && record.Name.Full) {
        const parts = record.Name.Full.trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = firstName || parts[0];
          lastName = lastName || parts.slice(1).join(' ');
        }
      }
    }
  }

  // Try FullName, DisplayName, PersonName fields
  if (!firstName || !lastName) {
    const fullName = record?.FullName || record?.DisplayName || record?.PersonName || '';
    if (fullName) {
      const parts = fullName.toString().trim().split(/\s+/);
      if (parts.length >= 2) {
        firstName = firstName || parts[0];
        lastName = lastName || parts.slice(1).join(' ');
      } else if (parts.length === 1 && !firstName) {
        firstName = parts[0];
      }
    }
  }

  return { firstName, lastName };
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
  subscriptionKey: string,
  clientId: string
): Promise<any | null> {
  try {
    const url = `${CM_PERSONS_URL}/${personId}?clientid=${clientId}&includecamperdetails=true&includecontactdetails=true&includerelatives=true&includestaffdetails=true`;
    console.log(`[Fetch Person] Using clientId=${clientId} for person ${personId}`);
    const response = await rateLimitedFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // Debug: Log structure of returned person data
      if (data && !data.Name?.First) {
        console.log(`[Fetch Person DEBUG] Person ${personId} returned but missing Name.First. Keys: ${Object.keys(data).join(', ')}`);
        if (data.Name) {
          console.log(`[Fetch Person DEBUG] Name object keys: ${Object.keys(data.Name).join(', ')}, values: First="${data.Name.First || ''}", Last="${data.Name.Last || ''}"`);
        }
      }
      return data;
    } else {
      // Log error response body for debugging
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = 'Could not read error body';
      }
      console.warn(`[Fetch Person] Failed to fetch person ${personId}: ${response.status} - ${errorBody.substring(0, 500)}`);
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
  clientId: string,
  entityType: string
): Promise<{ fetched: number; failed: number }> {
  let fetched = 0;
  let failed = 0;
  
  console.log(`\n[${entityType}] Fetching ${missingIds.length} missing persons individually...`);
  
  for (let i = 0; i < missingIds.length; i++) {
    const personId = missingIds[i];
    const person = await fetchPersonById(personId, token, subscriptionKey, clientId);
    
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
  lastSyncAt?: string,
  syncType: string = 'full'
): Promise<void> {
  const syncTypeLabel = syncType === 'full' ? 'FULL' : syncType.toUpperCase() + ' ONLY';
  
  console.log(`\n========================================`);
  console.log(`Starting ${isIncremental ? 'INCREMENTAL ' : ''}${syncTypeLabel} sync for company ${companyId}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`Sync Type: ${syncType}`);
  console.log(`[Sync Debug] version=2025-01-09-split-sync`);
  if (isIncremental && lastSyncAt) {
    console.log(`[Incremental] Last sync: ${lastSyncAt}`);
  }
  console.log(`========================================\n`);
  
  try {
    await updateSyncJob(supabase, jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
      progress: { step: 'Starting sync', syncType: syncType, isIncremental },
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

    // =====================================================
    // Initialize all variables needed across sync phases
    // =====================================================
    let enrolledAttendees: any[] = [];
    const attendeeDataMap = new Map<string, any>();
    let enrolledPersonIdArray: string[] = [];
    let sessions: any[] = [];
    const personMap = new Map<string, any>();
    const camperToParentMap = new Map<string, string>();
    const parentEmailMap = new Map<string, string>();
    const parentPhoneMap = new Map<string, string>();
    const parentNameMap = new Map<string, string>();
    let campers: any[] = [];
    let missingCamperIds: string[] = [];
    let staffAssignments: any[] = [];
    const staffFallbackMap = new Map<string, any>();
    const staffPersonIdsFromAssignments = new Set<string>();
    const staffAssignmentMap = new Map<string, any>();
    const parentPersonIds = new Set<string>();
    
    // Staff tracking variables - must be initialized before conditional blocks
    let staffChanges: ChangeRecord[] = [];
    let staffInsertedCount = 0;
    let staffUpdatedCount = 0;
    let usedFallbackData = 0;
    
    // Camper and staff data arrays - declared here for cleanup phase access
    let camperData: { person_id: string; [key: string]: any }[] = [];
    let staffData: { person_id: string; [key: string]: any }[] = [];

    // =====================================================
    // PHASE 2: Fetch enrolled attendees (for CAMPER sync)
    // Only run if syncType is 'campers' or 'full'
    // =====================================================
    if (syncType === 'campers' || syncType === 'full') {
      console.log('\n--- FETCHING ENROLLED ATTENDEES (camper sync) ---');
      await updateSyncJob(supabase, jobId, {
        progress: { step: 'Fetching enrolled attendees', divisions: divisions.length, season, syncType },
      });

      enrolledAttendees = await fetchAllPaginated(
        `${CM_SESSIONS_URL}/attendees`,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: season, status: 2 }
      );
      console.log(`Found ${enrolledAttendees.length} enrolled attendees`);

      if (enrolledAttendees.length > 0) {
        console.log('[DEBUG] Sample session attendee record:', JSON.stringify(enrolledAttendees[0], null, 2));
      }

      // Build a map of attendee data for fallback
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
      enrolledPersonIdArray = Array.from(enrolledPersonIds);

      // Fetch sessions for session NAME lookup
      console.log('\n--- FETCHING SESSIONS FOR NAME LOOKUP ---');
      sessions = await fetchAllPaginated(
        CM_SESSIONS_URL,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: season }
      );
      console.log(`Found ${sessions.length} sessions for name lookup`);

      // =====================================================
      // PHASE 3: Fetch ONLY enrolled campers person data
      // =====================================================
      console.log(`\n--- FETCHING PERSON DATA FOR ${enrolledPersonIdArray.length} ENROLLED CAMPERS ---`);
      
      await updateSyncJob(supabase, jobId, {
        progress: { 
          step: 'Fetching camper person data', 
          divisions: divisions.length, 
          enrolledCampers: enrolledPersonIdArray.length,
          season,
          syncType
        },
      });

      let fetchedCount = 0;
      let failedCount = 0;
      
      console.log(`\n[Camper Fetch] Starting to fetch ${enrolledPersonIdArray.length} campers individually...`);
      
      for (let i = 0; i < enrolledPersonIdArray.length; i++) {
        const personId = enrolledPersonIdArray[i];
        const person = await fetchPersonById(personId, token, subscriptionKey, clientId);
        
        if (person) {
          personMap.set(personId, person);
          fetchedCount++;
          
          if (fetchedCount === 1 && person.Relatives && person.Relatives.length > 0) {
            console.log('[DEBUG] Sample camper with Relatives:', JSON.stringify({
              ID: person.ID,
              Name: person.Name,
              Relatives: person.Relatives,
              ContactDetails: person.ContactDetails
            }, null, 2));
          }
        } else {
          failedCount++;
        }
        
        if ((i + 1) % 100 === 0 || i === enrolledPersonIdArray.length - 1) {
          console.log(`[Camper Fetch] Progress: ${i + 1}/${enrolledPersonIdArray.length} (${fetchedCount} success, ${failedCount} failed)`);
        }
      }
      
      console.log(`\n[Camper Fetch] Completed: ${fetchedCount} fetched, ${failedCount} failed out of ${enrolledPersonIdArray.length}`);
      console.log(`Built person map with ${personMap.size} camper entries`);

      // Identify missing campers
      for (const personId of enrolledPersonIdArray) {
        if (!personMap.has(personId)) {
          missingCamperIds.push(personId);
        }
      }

      // Filter to only enrolled campers with CamperDetails
      for (const personId of enrolledPersonIdArray) {
        const person = personMap.get(personId);
        if (person && person.CamperDetails) {
          campers.push(person);
        }
      }
      
      console.log(`✓ Total campers with CamperDetails: ${campers.length}`);
      console.log(`  Missing camper IDs: ${missingCamperIds.length}`);
    } else {
      console.log(`\n--- SKIPPING CAMPER FETCH (syncType=${syncType}) ---`);
    }

    // =====================================================
    // PHASE 3b: Fetch staff assignments (for STAFF sync)
    // Only run if syncType is 'staff' or 'full'
    // =====================================================
    if (syncType === 'staff' || syncType === 'full') {
      console.log('\n--- FETCHING STAFF ASSIGNMENTS (staff sync) ---');
      
      const currentSeason = season;
      const fallbackSeason = '2025';
      
      // Fetch Active staff (status=1) and Hired staff (status=2), then combine
      console.log(`[Staff Sync] Fetching Active (status=1) and Hired (status=2) staff for season ${currentSeason}...`);
      
      // Fetch Active staff
      const activeStaff = await fetchAllPaginated(
        CM_STAFF_URL,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: currentSeason, status: 1 }
      );
      console.log(`Found ${activeStaff.length} Active staff for season ${currentSeason}`);
      
      // Fetch Hired staff
      const hiredStaff = await fetchAllPaginated(
        CM_STAFF_URL,
        token,
        subscriptionKey,
        { clientid: clientId, seasonid: currentSeason, status: 2 }
      );
      console.log(`Found ${hiredStaff.length} Hired staff for season ${currentSeason}`);
      
      // Combine and dedupe by PersonID
      const staffMap = new Map<string, any>();
      for (const s of [...activeStaff, ...hiredStaff]) {
        if (s.PersonID) {
          staffMap.set(String(s.PersonID), s);
        }
      }
      staffAssignments = Array.from(staffMap.values());
      console.log(`Combined ${staffAssignments.length} unique staff (Active + Hired) for season ${currentSeason}`);

      if (staffAssignments.length === 0) {
        console.log(`[Staff Sync] No staff found for ${currentSeason}, trying ${fallbackSeason}...`);
        
        const activeStaffFallback = await fetchAllPaginated(
          CM_STAFF_URL,
          token,
          subscriptionKey,
          { clientid: clientId, seasonid: fallbackSeason, status: 1 }
        );
        const hiredStaffFallback = await fetchAllPaginated(
          CM_STAFF_URL,
          token,
          subscriptionKey,
          { clientid: clientId, seasonid: fallbackSeason, status: 2 }
        );
        
        const fallbackMap = new Map<string, any>();
        for (const s of [...activeStaffFallback, ...hiredStaffFallback]) {
          if (s.PersonID) {
            fallbackMap.set(String(s.PersonID), s);
          }
        }
        staffAssignments = Array.from(fallbackMap.values());
        console.log(`Combined ${staffAssignments.length} unique staff (Active + Hired) for fallback season ${fallbackSeason}`);
      }

      if (staffAssignments.length > 0) {
        console.log('[DEBUG] Sample staff assignment:', JSON.stringify(staffAssignments[0], null, 2));
      }

      // Build staff fallback map using robust name extraction
      let staffWithNames = 0;
      let staffWithoutNames = 0;
      for (const assignment of staffAssignments) {
        if (assignment.PersonID) {
          const personId = String(assignment.PersonID);
          staffPersonIdsFromAssignments.add(personId);
          staffAssignmentMap.set(personId, assignment);
          
          // Use robust name extraction
          const { firstName, lastName } = extractName(assignment);
          
          if (firstName && lastName) {
            staffWithNames++;
          } else {
            staffWithoutNames++;
            if (staffWithoutNames <= 3) {
              console.log(`[Staff Name Debug] Missing name for ${personId}, keys: ${Object.keys(assignment).join(', ')}`);
            }
          }
          
          staffFallbackMap.set(personId, {
            PersonID: personId,
            FirstName: firstName,
            LastName: lastName,
            Email: assignment.Email || assignment.email || '',
            Phone: assignment.Phone || assignment.PhoneNumber || assignment.phone || '',
            Position1ID: assignment.Position1ID,
            PositionID: assignment.PositionID,
            DateOfBirth: assignment.DateOfBirth || assignment.DOB || null,
          });
        }
      }
      console.log(`Built staff fallback map: ${staffWithNames} with names, ${staffWithoutNames} missing names (total ${staffFallbackMap.size})`);
    } else {
      console.log(`\n--- SKIPPING STAFF FETCH (syncType=${syncType}) ---`);
    }

    // Staff use fallback data from /staff endpoint
    const staffPersonIds = staffPersonIdsFromAssignments;

    // =====================================================
    // PHASE 4: Extract parent info from Relatives array (for camper sync)
    // =====================================================
    let campersWithParents = 0;
    let campersWithoutParents = 0;
    
    if (syncType === 'campers' || syncType === 'full') {
      console.log('\n--- EXTRACTING PARENT INFO FROM RELATIVES ---');
    
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
    } // End of phase 5 (parent fetching)
    } // End of parent info extraction (camper sync - syncType === 'campers' || syncType === 'full')

    // =====================================================
    // PHASE 6: Sync campers to database (including fallback for missing persons)
    // =====================================================
    // Variables for tracking camper changes - declared outside if blocks
    let camperChanges: ChangeRecord[] = [];
    let camperInsertedCount = 0;
    let camperUpdatedCount = 0;
    let usedCamperFallbackData = 0;

    if (syncType === 'campers' || syncType === 'full') {
      console.log('\n--- SYNCING CAMPERS ---');
      
      // Identify campers that we still don't have in personMap after fetching missing
      const stillMissingCamperIds = missingCamperIds.filter(id => !personMap.has(id));
      console.log(`[Camper Fallback] ${stillMissingCamperIds.length} campers still missing from personMap, will use attendee data`);
      
      await updateSyncJob(supabase, jobId, {
        progress: { step: 'Syncing campers', total: campers.length + stillMissingCamperIds.length, divisions: divisions.length, parentEmails: parentEmailMap.size, season },
        total_counts: { divisions: divisions.length, campers: campers.length + stillMissingCamperIds.length },
      });

      const gradeMap: Record<number, string> = {
        0: 'Pre-K', 1: 'K', 2: '1st', 3: '2nd', 4: '3rd', 5: '4th',
        6: '5th', 7: '6th', 8: '7th', 9: '8th', 10: '9th', 11: '10th', 12: '11th', 13: '12th'
      };

    // Note: camperData is declared in initialization section

    // Process campers from persons API
    let skippedCampersNoName = 0;
    for (const person of campers) {
      const firstName = (person.Name?.First || '').trim();
      const lastName = (person.Name?.Last || '').trim();
      
      // Skip if missing first OR last name - require both for valid record
      if (!firstName || !lastName) {
        console.log(`[Camper Skip] Missing first or last name for PersonID ${person.ID} (first="${firstName}", last="${lastName}") - skipping`);
        skippedCampersNoName++;
        continue;
      }
      
      const name = `${firstName} ${lastName}`;
      
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
    
    console.log(`[Campers] Skipped ${skippedCampersNoName} campers missing first or last name`);

    // Add fallback records for campers not in persons API but in attendees
    // Only create records if we have a valid name from the fallback data
    for (const personId of stillMissingCamperIds) {
      const fallbackData = attendeeDataMap.get(personId);
      
      // Only proceed if we have BOTH first AND last name from fallback data
      const firstName = (fallbackData?.FirstName || '').trim();
      const lastName = (fallbackData?.LastName || '').trim();
      
      if (!firstName || !lastName) {
        console.log(`[Camper Skip] Missing first or last name for PersonID ${personId} (first="${firstName}", last="${lastName}") - skipping`);
        continue;
      }
      
      const name = `${firstName} ${lastName}`;
      
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
    } // End of camper sync (syncType === 'campers' || syncType === 'full')

    // =====================================================
    // PHASE 7: Sync staff with complete person data
    // Only run if syncType is 'staff' or 'full'
    // =====================================================
    if (syncType === 'staff' || syncType === 'full') {
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
    
    // DEBUG: Log what we have in maps
    console.log(`[DEBUG] personMap size: ${personMap.size}, staffFallbackMap size: ${staffFallbackMap.size}`);
    
    // Sample the first few staff IDs to debug
    const sampleStaffIds = Array.from(staffPersonIds).slice(0, 3);
    for (const sid of sampleStaffIds) {
      const person = personMap.get(sid);
      const fallback = staffFallbackMap.get(sid);
      console.log(`[DEBUG] Staff ${sid}: personMap has=${!!person}, fallbackMap has=${!!fallback}, fallback names="${fallback?.FirstName || ''} ${fallback?.LastName || ''}"`);
    }

    // =====================================================
    // PHASE 7a: Fetch missing staff person details
    // The /staff endpoint often doesn't include name data, so we need to 
    // fetch individual person records for staff not in personMap
    // =====================================================
    const missingStaffIds = Array.from(staffPersonIds).filter(id => {
      const person = personMap.get(id);
      const fallback = staffFallbackMap.get(id);
      // Check if we have BOTH first AND last name from either source
      const personHasBothNames = person?.Name?.First?.trim() && person?.Name?.Last?.trim();
      const fallbackHasBothNames = fallback?.FirstName?.trim() && fallback?.LastName?.trim();
      // Missing if neither source has both names
      return !personHasBothNames && !fallbackHasBothNames;
    });
    
    console.log(`[DEBUG] missingStaffIds count: ${missingStaffIds.length} (out of ${staffPersonIds.size} total)`);

    // For staff-only sync, fetch all missing. For full sync, limit to prevent timeout
    const MAX_INDIVIDUAL_FETCHES = syncType === 'staff' ? 500 : 100;
    if (missingStaffIds.length > 0) {
      const toFetch = missingStaffIds.slice(0, MAX_INDIVIDUAL_FETCHES);
      console.log(`\n[Staff] ${missingStaffIds.length} staff missing name data - fetching ${toFetch.length} individually (syncType=${syncType})...`);
      
      if (missingStaffIds.length > MAX_INDIVIDUAL_FETCHES) {
        console.log(`[Staff] NOTE: ${missingStaffIds.length - MAX_INDIVIDUAL_FETCHES} additional staff will require another sync`);
      }
      
      await updateSyncJob(supabase, jobId, {
        progress: { step: `Fetching ${toFetch.length} missing staff details`, staff: staffPersonIds.size, season },
      });

      let fetchedCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < toFetch.length; i++) {
        const personId = toFetch[i];
        const person = await fetchPersonById(personId, token, subscriptionKey, clientId);
        
        if (person && person.Name) {
          personMap.set(personId, person);
          fetchedCount++;
          
          if (fetchedCount <= 5) {
            const name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim();
            console.log(`[Staff Fetch] Got ${personId}: ${name}`);
          }
        } else {
          failedCount++;
        }
        
        // Progress update every 25 persons
        if ((i + 1) % 25 === 0) {
          console.log(`[Staff Fetch] Progress: ${i + 1}/${toFetch.length} (${fetchedCount} success, ${failedCount} failed)`);
          await updateSyncJob(supabase, jobId, {
            progress: { step: `Fetching staff details: ${i + 1}/${toFetch.length}`, staff: staffPersonIds.size, season },
          });
        }
      }
      
      console.log(`[Staff Fetch] Completed: ${fetchedCount} fetched, ${failedCount} failed`);
    } else {
      console.log(`[Staff] All ${staffPersonIds.size} staff have name data available - no individual fetches needed`);
    }

    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Syncing staff', total: staffPersonIds.size, campers: campers.length, divisions: divisions.length, season },
      total_counts: { divisions: divisions.length, campers: campers.length, staff: staffPersonIds.size },
    });

    if (staffPersonIds.size > 0) {
      // Note: staffData is declared in initialization section
      
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
        
        let firstName = '';
        let lastName = '';
        
        // Use robust name extraction from all sources
        if (person && person.Name) {
          // Person data available from persons API
          const extracted = extractName(person);
          firstName = extracted.firstName;
          lastName = extracted.lastName;
          dateOfBirth = person.DateOfBirth || null;
          
          if (person.ContactDetails?.Emails?.length > 0) {
            email = person.ContactDetails.Emails[0].Address;
          }
          if (person.ContactDetails?.PhoneNumbers?.length > 0) {
            phone = person.ContactDetails.PhoneNumbers[0].Number;
          }
        }
        
        // Fall back to staff assignment data
        if ((!firstName || !lastName) && fallbackData) {
          firstName = firstName || (fallbackData.FirstName || '').trim();
          lastName = lastName || (fallbackData.LastName || '').trim();
          email = email || fallbackData.Email || '';
          phone = phone || fallbackData.Phone || '';
          dateOfBirth = dateOfBirth || fallbackData.DateOfBirth || null;
          usedFallback = true;
        }
        
        // Last resort: try extracting from the assignment itself
        if ((!firstName || !lastName) && assignment) {
          const extracted = extractName(assignment);
          firstName = firstName || extracted.firstName;
          lastName = lastName || extracted.lastName;
        }
        
        // Skip if missing first OR last name - require both for valid record
        if (!firstName || !lastName) {
          if (skippedNoName < 5) {
            console.log(`[Staff Skip] Missing name for PersonID ${personId} (first="${firstName}", last="${lastName}")`);
          }
          skippedNoName++;
          continue;
        }
        
        name = `${firstName} ${lastName}`;
        if (usedFallback) usedFallbackData++;
        
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
    } // End of staff sync (syncType === 'staff' || syncType === 'full')

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

    // =====================================================
    // PHASE 9: Cleanup - Remove records not in CampMinder
    // =====================================================
    console.log('\n--- CLEANUP: Removing records not in CampMinder ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Cleaning up old records', staff: staffPersonIds.size, campers: campers.length, divisions: divisions.length, season },
    });

    let campersDeleted = 0;
    let staffDeleted = 0;

    try {
      // Get all person_ids that were synced from CampMinder
      const syncedCamperPersonIds = camperData.map(c => c.person_id);
      const syncedStaffPersonIds = staffData.map(s => s.person_id);

      // Delete campers that are no longer in CampMinder (only for full or campers sync)
      if ((syncType === 'full' || syncType === 'campers') && syncedCamperPersonIds.length > 0) {
        console.log(`[Cleanup] Checking for campers not in CampMinder sync (${syncedCamperPersonIds.length} valid campers)...`);
        
        // Get campers that exist in DB but were NOT in this sync
        const { data: existingCampers, error: fetchError } = await supabase
          .from('children')
          .select('id, person_id, first_name, last_name')
          .eq('company_id', companyId)
          .eq('season', season);

        if (fetchError) {
          console.error('[Cleanup] Error fetching existing campers:', fetchError);
        } else if (existingCampers) {
          const camperPersonIdSet = new Set(syncedCamperPersonIds);
          const campersToDelete = existingCampers.filter((c: { id: string; person_id: string; first_name: string; last_name: string }) => !camperPersonIdSet.has(c.person_id));
          
          if (campersToDelete.length > 0) {
            console.log(`[Cleanup] Found ${campersToDelete.length} campers to remove (not enrolled in CampMinder):`);
            campersToDelete.slice(0, 10).forEach((c: { id: string; person_id: string; first_name: string; last_name: string }) => {
              console.log(`  - ${c.first_name} ${c.last_name} (person_id: ${c.person_id})`);
            });
            if (campersToDelete.length > 10) {
              console.log(`  ... and ${campersToDelete.length - 10} more`);
            }

            const idsToDelete = campersToDelete.map((c: { id: string }) => c.id);
            const { error: deleteError } = await supabase
              .from('children')
              .delete()
              .in('id', idsToDelete);

            if (deleteError) {
              console.error('[Cleanup] Error deleting campers:', deleteError);
            } else {
              campersDeleted = campersToDelete.length;
              console.log(`[Cleanup] Successfully deleted ${campersDeleted} campers`);
            }
          } else {
            console.log('[Cleanup] No campers to remove - all match CampMinder data');
          }
        }
      }

      // Delete staff that are no longer in CampMinder (only for full or staff sync)
      if ((syncType === 'full' || syncType === 'staff') && syncedStaffPersonIds.length > 0) {
        console.log(`[Cleanup] Checking for staff not in CampMinder sync (${syncedStaffPersonIds.length} valid staff)...`);
        
        // Get staff that exist in DB but were NOT in this sync
        const { data: existingStaff, error: fetchError } = await supabase
          .from('staff')
          .select('id, person_id, name')
          .eq('company_id', companyId)
          .eq('season', season);

        if (fetchError) {
          console.error('[Cleanup] Error fetching existing staff:', fetchError);
        } else if (existingStaff) {
          const staffPersonIdSet = new Set(syncedStaffPersonIds);
          const staffToDelete = existingStaff.filter((s: { id: string; person_id: string; name: string }) => !staffPersonIdSet.has(s.person_id));
          
          if (staffToDelete.length > 0) {
            console.log(`[Cleanup] Found ${staffToDelete.length} staff to remove (not hired/active in CampMinder):`);
            staffToDelete.slice(0, 10).forEach((s: { id: string; person_id: string; name: string }) => {
              console.log(`  - ${s.name} (person_id: ${s.person_id})`);
            });
            if (staffToDelete.length > 10) {
              console.log(`  ... and ${staffToDelete.length - 10} more`);
            }

            const idsToDelete = staffToDelete.map((s: { id: string }) => s.id);
            const { error: deleteError } = await supabase
              .from('staff')
              .delete()
              .in('id', idsToDelete);

            if (deleteError) {
              console.error('[Cleanup] Error deleting staff:', deleteError);
            } else {
              staffDeleted = staffToDelete.length;
              console.log(`[Cleanup] Successfully deleted ${staffDeleted} staff`);
            }
          } else {
            console.log('[Cleanup] No staff to remove - all match CampMinder data');
          }
        }
      }

      console.log(`[Cleanup Summary] Deleted ${campersDeleted} campers, ${staffDeleted} staff`);
    } catch (error) {
      console.error('[Cleanup] Error during cleanup phase:', error);
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
      missing_campers_count: missingCamperIds.length,
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
  const { company_id, season_id, incremental, sync_type } = await req.json().catch(() => ({}));
    
    // sync_type can be: 'campers', 'staff', or 'full' (default)
    // This allows splitting syncs: campers at :00, staff at :30
    const effectiveSyncType = sync_type || 'full';
    
    console.log('Sync request received:', { company_id, season_id, incremental, sync_type: effectiveSyncType });

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
            lastSyncAt,
            effectiveSyncType
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
