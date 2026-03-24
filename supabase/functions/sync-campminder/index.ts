import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CM_AUTH_URL = 'https://api.campminder.com/auth/apikey';
const CM_PERSONS_URL = 'https://api.campminder.com/persons';
const CM_STAFF_URL = 'https://api.campminder.com/staff';
const CM_DIVISIONS_URL = 'https://api.campminder.com/divisions';
const CM_SESSIONS_URL = 'https://api.campminder.com/sessions';
const CM_BUNKS_URL = 'https://api.campminder.com/bunks';
const CM_FAMILIES_URL = 'https://api.campminder.com/families';
const CM_FINANCIALS_URL = 'https://api.campminder.com/financials/transactionreporting/transactiondetails';


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

  // CampMinder appears to cap pagesize (often at 200). If we request a larger size
  // and then stop when we get less than requested, we will *silently* truncate.
  // So we adapt to the API’s effective page size after the first response.
  let pageSize = 500;

  let hasMore = true;

  const maxPages = 200; // safety guard against infinite loops

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
    const items = (data?.Results ?? data?.data ?? data?.items ?? data) || [];

    if (!Array.isArray(items)) {
      console.warn(`[Pagination] Non-array response for ${baseUrl} page=${pageNumber}. Keys=${data ? Object.keys(data).join(',') : 'none'}`);
      break;
    }

    allItems.push(...items);

    // Try to detect server-provided pagination metadata
    const metaPageNumber = Number(data?.PageNumber ?? data?.pageNumber ?? data?.pagenumber ?? pageNumber);
    const metaPageSize = Number(data?.PageSize ?? data?.pageSize ?? data?.pagesize ?? NaN);
    const metaTotalPages = Number(data?.TotalPages ?? data?.totalPages ?? data?.PageCount ?? data?.pageCount ?? NaN);
    const metaTotalResults = Number(data?.TotalResults ?? data?.totalResults ?? data?.TotalCount ?? data?.totalCount ?? NaN);

    console.log(
      `Fetched page ${pageNumber}: ${items.length} items (total: ${allItems.length})` +
        (Number.isFinite(metaTotalPages) ? ` | TotalPages=${metaTotalPages}` : '') +
        (Number.isFinite(metaTotalResults) ? ` | TotalResults=${metaTotalResults}` : '') +
        (Number.isFinite(metaPageSize) ? ` | PageSize=${metaPageSize}` : '')
    );

    // If the API caps pagesize (common: 200), adapt our comparison so we keep paging.
    if (pageNumber === 1) {
      if (Number.isFinite(metaPageSize) && metaPageSize > 0) {
        if (metaPageSize !== pageSize) {
          console.log(`[Pagination] API reports PageSize=${metaPageSize}; adapting from requested=${pageSize}`);
        }
        pageSize = metaPageSize;
      } else if (items.length > 0 && items.length < pageSize) {
        console.log(`[Pagination] API returned ${items.length} on first page with requested pagesize=${pageSize}; assuming cap and adapting.`);
        pageSize = items.length;
      }
    }

    // Decide whether there are more pages
    if (Number.isFinite(metaTotalPages) && metaTotalPages > 0) {
      hasMore = metaPageNumber < metaTotalPages;
    } else if (Number.isFinite(metaTotalResults) && metaTotalResults >= 0 && pageSize > 0) {
      hasMore = allItems.length < metaTotalResults;
    } else {
      // Fallback: continue if we got a "full" page
      hasMore = pageSize > 0 && items.length === pageSize;
    }

    pageNumber++;

    if (pageNumber > maxPages) {
      console.warn(`Reached maximum page limit (${maxPages}) for ${baseUrl}`);
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

    // Initialize bunk mapping early - needed before bunk sync phase
    const cmBunkIdMap = new Map<number, string>();

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
    // PHASE 1b: Fetch and sync bunks from CampMinder
    // =====================================================
    console.log('\n--- SYNCING BUNKS ---');
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Fetching bunks', season },
    });

    const cmBunks = await fetchAllPaginated(
      CM_BUNKS_URL,
      token,
      subscriptionKey,
      { clientid: clientId, seasonid: season }
    );
    console.log(`Found ${cmBunks.length} bunks from CampMinder`);

    if (cmBunks.length > 0) {
      console.log('[DEBUG] Sample bunk record:', JSON.stringify(cmBunks[0], null, 2));
      
      // Fetch existing bunks from our database
      const { data: existingBunks } = await supabase
        .from('bunks')
        .select('id, bunk_number, bunk_name, cm_bunk_id, division_id')
        .eq('company_id', companyId)
        .eq('season', season);
      
      // Define bunk type for proper typing
      interface ExistingBunk {
        id: string;
        bunk_number: number;
        bunk_name: string | null;
        cm_bunk_id: number | null;
        division_id: string | null;
      }
      
      // Map existing bunks by cm_bunk_id for updates
      const existingBunkByCmId = new Map<number, ExistingBunk>(
        (existingBunks as ExistingBunk[] | null)?.filter((b) => b.cm_bunk_id).map((b) => [b.cm_bunk_id!, b]) || []
      );
      
      // Map existing bunks by name for matching
      const existingBunkByName = new Map<string, ExistingBunk>(
        (existingBunks as ExistingBunk[] | null)?.map((b) => [(b.bunk_name || `Bunk ${b.bunk_number}`).toLowerCase(), b]) || []
      );
      
      console.log(`[Bunks] Found ${existingBunks?.length || 0} existing bunks in database`);
      
      let bunksCreated = 0;
      let bunksUpdated = 0;
      
      for (const cmBunk of cmBunks) {
        const cmBunkId = cmBunk.ID || cmBunk.BunkID;
        const bunkName = cmBunk.Name || cmBunk.BunkName || `Bunk ${cmBunkId}`;
        
        // Try to find existing bunk by cm_bunk_id first, then by name
        let existingBunk: ExistingBunk | undefined = existingBunkByCmId.get(cmBunkId);
        if (!existingBunk) {
          existingBunk = existingBunkByName.get(bunkName.toLowerCase());
        }
        
        // Map CampMinder division to our division
        const cmDivisionId = cmBunk.DivisionID;
        const ourDivisionId = cmDivisionId ? cmDivisionIdMap.get(cmDivisionId) : null;
        
        if (existingBunk) {
          // Update existing bunk with cm_bunk_id if not already set
          if (!existingBunk.cm_bunk_id || existingBunk.cm_bunk_id !== cmBunkId) {
            await supabase
              .from('bunks')
              .update({ 
                cm_bunk_id: cmBunkId,
                bunk_name: bunkName,
                division_id: ourDivisionId || existingBunk.division_id,
              })
              .eq('id', existingBunk.id);
            bunksUpdated++;
          }
          // Store mapping
          cmBunkIdMap.set(cmBunkId, existingBunk.id);
        } else {
          // Create new bunk
          const { data: newBunk, error } = await supabase
            .from('bunks')
            .insert({
              bunk_number: cmBunkId, // Use CM ID as bunk number
              bunk_name: bunkName,
              cm_bunk_id: cmBunkId,
              company_id: companyId,
              season: season,
              division_id: ourDivisionId,
              is_active: true,
            })
            .select()
            .single();
          
          if (newBunk) {
            cmBunkIdMap.set(cmBunkId, newBunk.id);
            bunksCreated++;
          } else if (error) {
            console.error(`[Bunks] Error creating bunk ${bunkName}:`, error.message);
          }
        }
      }
      
      console.log(`[Bunks] Sync complete: ${bunksCreated} created, ${bunksUpdated} updated`);
      console.log(`[Bunks] Built mapping for ${cmBunkIdMap.size} bunks`);
    }

    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Bunks synced', bunks: cmBunks.length, divisions: divisions.length, season },
      total_counts: { divisions: divisions.length, bunks: cmBunks.length },
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
    
    // Note: cmBunkIdMap is declared earlier in the function (line ~520)
    
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
          BunkID: attendee.BunkID || null,
          BunkPlanID: attendee.BunkPlanID || null,
        });
      }
      console.log(`Built attendee fallback map with ${attendeeDataMap.size} entries`);

      // Log unique BunkIDs found in attendee data
      const uniqueBunkIds = new Set<number>();
      for (const attendee of enrolledAttendees) {
        if (attendee.BunkID) {
          uniqueBunkIds.add(attendee.BunkID);
        }
      }
      console.log(`[Bunk Sync] Found ${uniqueBunkIds.size} unique BunkIDs in attendee data`);
      if (uniqueBunkIds.size > 0) {
        console.log(`[Bunk Sync] BunkIDs: ${Array.from(uniqueBunkIds).slice(0, 10).join(', ')}${uniqueBunkIds.size > 10 ? '...' : ''}`);
      }

      // Fetch existing bunks from our database to map by bunk_number
      // CampMinder BunkID appears to be their internal ID - we'll need to create bunks
      // and store the CM BunkID for future reference, or map by name/number
      const { data: existingBunks } = await supabase
        .from('bunks')
        .select('id, bunk_number, bunk_name')
        .eq('company_id', companyId)
        .eq('is_active', true);
      
      if (existingBunks) {
        console.log(`[Bunk Sync] Found ${existingBunks.length} existing bunks in database`);
        // For now, we'll map CampMinder BunkID directly to our bunk IDs
        // In a full implementation, you might want to store cm_bunk_id on bunks table
        for (const bunk of existingBunks) {
          // Map bunk_number to itself as a simple mapping
          cmBunkIdMap.set(bunk.bunk_number, bunk.id);
        }
      }


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
      
      // IMPORTANT: Per CampMinder Staff API docs, status IDs are:
      // 1=Active, 2=Resigned, 3=Dismissed, 4=Cancelled
      // We ONLY sync Active staff (status=1) - Resigned/Dismissed/Cancelled are not current staff
      // Expected counts (2026): Tyler Hill~290, Timber Lake Camp~230, Timber Lake West~180
      const allStatuses = [1]; // Only Active staff
      console.log(`[Staff Sync] Fetching Active staff (status: 1) for season ${currentSeason}...`);
      
      const staffMap = new Map<string, any>();
      
      for (const status of allStatuses) {
        const statusStaff = await fetchAllPaginated(
          CM_STAFF_URL,
          token,
          subscriptionKey,
          { clientid: clientId, seasonid: currentSeason, status }
        );
        console.log(`Found ${statusStaff.length} staff with status=${status} for season ${currentSeason}`);
        
        for (const s of statusStaff) {
          if (s.PersonID) {
            staffMap.set(String(s.PersonID), s);
          }
        }
      }
      
      staffAssignments = Array.from(staffMap.values());
      console.log(`Combined ${staffAssignments.length} unique Active staff for season ${currentSeason}`);

      // SAFEGUARD: Warn if count looks unusually low (expected ~250-300 for camps)
      if (staffAssignments.length < 100) {
        console.warn(`⚠️ [LOW COUNT WARNING] Only ${staffAssignments.length} Active staff found - expected 200-300 for camps`);
      }

      if (staffAssignments.length === 0) {
        console.log(`[Staff Sync] No staff found for ${currentSeason}, trying ${fallbackSeason}...`);
        
        const fallbackMap = new Map<string, any>();
        for (const status of allStatuses) {
          const fallbackStaff = await fetchAllPaginated(
            CM_STAFF_URL,
            token,
            subscriptionKey,
            { clientid: clientId, seasonid: fallbackSeason, status }
          );
          for (const s of fallbackStaff) {
            if (s.PersonID) {
              fallbackMap.set(String(s.PersonID), s);
            }
          }
        }
        staffAssignments = Array.from(fallbackMap.values());
        console.log(`Combined ${staffAssignments.length} unique Active staff for fallback season ${fallbackSeason}`);
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
    
    // Log first 5 campers' relative structures to understand the data
    let sampleCount = 0;
    for (const camper of campers) {
      const camperId = String(camper.ID);
      const relatives = camper.Relatives || [];
      
      // Log sample relatives to understand structure (first 5 campers with relatives)
      if (sampleCount < 5 && relatives.length > 0) {
        console.log(`[Sample Relative Data] Camper ${camperId}:`, JSON.stringify(relatives.slice(0, 2), null, 2));
        sampleCount++;
      }
      
      // Find P1 (Parent 1) from Relatives array
      // Per CampMinder Persons API docs, Relative schema has: ID, IsPrimary, IsGuardian, IsWard
      // IsPrimary: true = "parent 1" (P1)
      // IsGuardian: true = guardian
      // Priority: IsPrimary > IsGuardian > first relative
      const p1Parent = relatives.find((r: any) => r.IsPrimary === true);
      const guardian = p1Parent || 
                      relatives.find((r: any) => r.IsGuardian === true) || 
                      relatives[0]; // Fallback to first relative
      
      if (guardian && guardian.ID) {
        const parentId = String(guardian.ID);
        camperToParentMap.set(camperId, parentId);
        parentPersonIds.add(parentId);
        campersWithParents++;
        
        // FIRST: Check if email is directly on the Relative object (P1 Login Info)
        // CampMinder often includes Login, LoginEmail, Email, EmailAddress fields directly on relatives
        const directEmail = guardian.Login || guardian.LoginEmail || guardian.Email || 
                           guardian.EmailAddress || guardian.PrimaryEmail || guardian.ParentEmail ||
                           guardian.P1Login || guardian.P1Email;
        if (directEmail) {
          parentEmailMap.set(parentId, directEmail);
          console.log(`[Direct Relative Email] Found for parent ${parentId}: ${directEmail.substring(0, 20)}...`);
        }
        
        // Extract name from relative object
        // Handle Name as object {First, Last} or as string
        let directName = '';
        if (guardian.Name && typeof guardian.Name === 'object') {
          directName = `${guardian.Name.First || guardian.Name.first || ''} ${guardian.Name.Last || guardian.Name.last || ''}`.trim();
        } else if (guardian.Name && typeof guardian.Name === 'string') {
          directName = guardian.Name;
        } else {
          directName = guardian.FullName || 
                      `${guardian.FirstName || guardian.First || ''} ${guardian.LastName || guardian.Last || ''}`.trim();
        }
        if (directName && typeof directName === 'string' && directName.trim()) {
          parentNameMap.set(parentId, directName);
        }
        
        // Extract phone from relative object
        const directPhone = guardian.Phone || guardian.PhoneNumber || guardian.MobilePhone || 
                           guardian.CellPhone || guardian.PrimaryPhone;
        if (directPhone) {
          parentPhoneMap.set(parentId, directPhone);
        }
        
        // SECOND: If no direct email, try to get from personMap (for fetched persons)
        if (!directEmail) {
          const parentPerson = personMap.get(parentId);
          if (parentPerson) {
            // Extract parent name if not already set
            if (!parentNameMap.has(parentId)) {
              const parentName = `${parentPerson.Name?.First || ''} ${parentPerson.Name?.Last || ''}`.trim();
              if (parentName) {
                parentNameMap.set(parentId, parentName);
              }
            }
            
            // Extract parent email from ContactDetails
            if (parentPerson.ContactDetails?.Emails?.length > 0) {
              const loginEmail = parentPerson.ContactDetails.Emails.find((e: any) => e.IsLogin);
              const email = loginEmail?.Address || parentPerson.ContactDetails.Emails[0]?.Address;
              if (email) {
                parentEmailMap.set(parentId, email);
              }
            }
            
            // Extract parent phone from ContactDetails if not already set
            if (!parentPhoneMap.has(parentId) && parentPerson.ContactDetails?.PhoneNumbers?.length > 0) {
              const mobilePhone = parentPerson.ContactDetails.PhoneNumbers.find((p: any) => 
                p.Type === 'Mobile' || p.Type === 'Cell' || p.TypeID === 0 || p.TypeID === 2
              );
              const phone = mobilePhone?.Number || parentPerson.ContactDetails.PhoneNumbers[0]?.Number;
              if (phone) {
                parentPhoneMap.set(parentId, phone);
              }
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
    // PHASE 5: SKIP expensive parent person fetches to prevent timeouts
    // We use guardian data extracted directly from Relatives array (Phase 4)
    // This avoids 100s of individual API calls that caused sync timeouts
    // =====================================================
    console.log('\n--- SKIPPING PARENT PERSON FETCHES (using Relative data only) ---');
    console.log(`  Parents with names from Relatives: ${parentNameMap.size}`);
    console.log(`  Parents with emails from Relatives: ${parentEmailMap.size}`);
    console.log(`  Parents with phones from Relatives: ${parentPhoneMap.size}`);
    console.log(`  NOTE: To fetch complete parent contact details, run cleanup-campminder separately`);
    
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
      
      // NO FALLBACK to camper's own contact info - we only want P1 parent email
      // If no P1 parent email found, leave guardian_email empty (do not use camper's email)
      // Phone fallback is acceptable since it's less critical than email
      if (!guardianPhone && person.ContactDetails?.PhoneNumbers?.length > 0) {
        guardianPhone = person.ContactDetails.PhoneNumbers[0].Number;
      }

      // Get division directly from CamperDetails.DivisionID (the correct source!)
      const cmDivisionId = person.CamperDetails?.DivisionID;
      const divisionId = cmDivisionId ? cmDivisionIdMap.get(cmDivisionId) : null;
      
      if (!divisionId && cmDivisionId) {
        console.log(`[Division Warning] Camper ${name} has CamperDetails.DivisionID=${cmDivisionId} but no matching division in our DB`);
      }

      // Get bunk from attendee data (BunkID is in attendee, not person)
      const attendeeData = attendeeDataMap.get(String(person.ID));
      const cmBunkId = attendeeData?.BunkID;
      const bunkId = cmBunkId ? cmBunkIdMap.get(cmBunkId) : null;
      
      if (cmBunkId && !bunkId) {
        console.log(`[Bunk Warning] Camper ${name} has BunkID=${cmBunkId} but no matching bunk in our DB`);
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
        bunk_id: bunkId,
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
      
      // Get bunk from attendee/fallback data
      const cmBunkId = fallbackData.BunkID;
      const bunkId = cmBunkId ? cmBunkIdMap.get(cmBunkId) : null;
      
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
        bunk_id: bunkId,
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

      // =====================================================
      // PHASE 6b: Mark dropped campers as inactive
      // Campers in DB but NOT in enrolled attendees list
      // =====================================================
      console.log('\n--- CLEANING UP DROPPED CAMPERS ---');
      
      const enrolledPersonIdSet = new Set(camperData.map(c => c.person_id));
      
      // Fetch all existing active campers for this company + season
      const { data: existingCampers, error: fetchCampersError } = await supabase
        .from('children')
        .select('id, person_id, name, status')
        .eq('company_id', companyId)
        .eq('season', season)
        .neq('status', 'inactive');
      
      if (fetchCampersError) {
        console.error('[Camper Cleanup] Error fetching existing campers:', fetchCampersError);
      } else {
        const droppedCampers = (existingCampers || []).filter(
          (c: any) => c.person_id && !enrolledPersonIdSet.has(c.person_id)
        );
        
        console.log(`[Camper Cleanup] Found ${droppedCampers.length} campers to mark inactive (${existingCampers?.length || 0} total in DB, ${enrolledPersonIdSet.size} enrolled)`);
        
        if (droppedCampers.length > 0) {
          // Log first 10 for debugging
          droppedCampers.slice(0, 10).forEach((c: any) => {
            console.log(`  - Marking inactive: ${c.name} (person_id: ${c.person_id})`);
          });
          
          const droppedIds = droppedCampers.map((c: any) => c.id);
          
          // Update in batches of 100
          for (let i = 0; i < droppedIds.length; i += 100) {
            const batch = droppedIds.slice(i, i + 100);
            const { error: updateError } = await supabase
              .from('children')
              .update({ status: 'inactive', updated_at: new Date().toISOString() })
              .in('id', batch);
            
            if (updateError) {
              console.error(`[Camper Cleanup] Error marking batch inactive:`, updateError);
            }
          }
          
          console.log(`[Camper Cleanup] Successfully marked ${droppedCampers.length} dropped campers as inactive`);
        }
      }
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

    // Fetch missing staff details. Limiting this causes silent truncation because we skip
    // staff records without BOTH first+last names.
    // We keep a generous cap to avoid runaway runtimes, but large camps (e.g. Timber Lake)
    // can exceed 200 missing staff, so this must be > staff count.
    const MAX_INDIVIDUAL_FETCHES = 1000;
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
        
        // CLEANUP: Delete staff not in current active list
        // This handles staff who were Resigned, Dismissed, or Cancelled
        const activePersonIds = staffData.map(s => s.person_id);
        console.log(`[Staff Cleanup] Removing staff not in active list (${activePersonIds.length} active)`);
        
        const { data: existingStaff, error: fetchError } = await supabase
          .from('staff')
          .select('id, person_id, name')
          .eq('company_id', companyId)
          .eq('season', season);
        
        if (!fetchError && existingStaff) {
          const staffToRemove = existingStaff.filter((s: { id: string; person_id: string; name: string }) => !activePersonIds.includes(s.person_id));
          
          if (staffToRemove.length > 0) {
            console.log(`[Staff Cleanup] Found ${staffToRemove.length} staff to remove (not in active list)`);
            
            // Log first 5 for debugging
            staffToRemove.slice(0, 5).forEach((s: { id: string; person_id: string; name: string }) => {
              console.log(`  - Removing: ${s.name} (person_id: ${s.person_id})`);
            });
            
            const idsToRemove = staffToRemove.map((s: { id: string }) => s.id);
            const { error: deleteError } = await supabase
              .from('staff')
              .delete()
              .in('id', idsToRemove);
            
            if (deleteError) {
              console.error('[Staff Cleanup] Error removing inactive staff:', deleteError);
            } else {
              console.log(`[Staff Cleanup] Removed ${staffToRemove.length} inactive staff`);
            }
          } else {
            console.log('[Staff Cleanup] No inactive staff to remove');
          }
        }
      }
    } else {
      console.log('[Staff Sync] No staff found from any source. Check if staff data exists in CampMinder for this season.');
    }
    // =====================================================
    // PHASE 7b: Sync staff bunk assignments from CampMinder
    // Only run if syncType is 'staff' or 'full'
    // =====================================================
    if (staffAssignments.length > 0) {
      console.log('\n--- SYNCING STAFF BUNK ASSIGNMENTS ---');
      await updateSyncJob(supabase, jobId, {
        progress: { step: 'Syncing staff bunk assignments', staff: staffPersonIds.size, season },
      });

      // First, fetch existing staff IDs for lookup
      const { data: staffRecords } = await supabase
        .from('staff')
        .select('id, person_id')
        .eq('company_id', companyId)
        .eq('season', season);

      const staffPersonIdToId = new Map<string, string>();
      if (staffRecords) {
        for (const staff of staffRecords) {
          staffPersonIdToId.set(staff.person_id, staff.id);
        }
      }
      console.log(`[Staff Bunks] Found ${staffPersonIdToId.size} staff records for bunk mapping`);

      // Collect staff bunk assignments from CampMinder data
      let bunkAssignmentsToSync: { staff_id: string; bunk_id: string; person_id: string }[] = [];
      let staffWithBunks = 0;
      let staffWithoutBunks = 0;
      let unmappedBunks = 0;

      for (const assignment of staffAssignments) {
        const personId = String(assignment.PersonID);
        const staffId = staffPersonIdToId.get(personId);
        
        if (!staffId) {
          continue; // Staff not in our database
        }

        // BunkAssignments is an array of bunk IDs from CampMinder Staff API
        const bunkAssignments = assignment.BunkAssignments || [];
        
        if (bunkAssignments.length === 0) {
          staffWithoutBunks++;
          continue;
        }

        staffWithBunks++;

        for (const bunkAssignment of bunkAssignments) {
          // The bunk assignment contains an ID field (the CM BunkID)
          const cmBunkId = bunkAssignment.ID || bunkAssignment.BunkID || bunkAssignment;
          const ourBunkId = cmBunkIdMap.get(cmBunkId);
          
          if (ourBunkId) {
            bunkAssignmentsToSync.push({
              staff_id: staffId,
              bunk_id: ourBunkId,
              person_id: personId,
            });
          } else {
            unmappedBunks++;
            if (unmappedBunks <= 5) {
              console.log(`[Staff Bunks] Warning: CM BunkID ${cmBunkId} not mapped to our bunks`);
            }
          }
        }
      }

      console.log(`[Staff Bunks] ${staffWithBunks} staff have bunk assignments, ${staffWithoutBunks} without`);
      console.log(`[Staff Bunks] ${bunkAssignmentsToSync.length} total assignments to sync (${unmappedBunks} unmapped)`);

      // Clear existing staff bunk assignments for this company/season and re-insert
      if (bunkAssignmentsToSync.length > 0) {
        // Delete existing assignments for this company/season
        const { error: deleteError } = await supabase
          .from('bunk_staff')
          .delete()
          .eq('company_id', companyId)
          .eq('season', season);

        if (deleteError) {
          console.error('[Staff Bunks] Error clearing existing assignments:', deleteError);
        } else {
          console.log('[Staff Bunks] Cleared existing assignments');
        }

        // Insert new assignments
        const assignments = bunkAssignmentsToSync.map(a => ({
          company_id: companyId,
          season: season,
          staff_id: a.staff_id,
          bunk_id: a.bunk_id,
          is_primary: false, // CampMinder doesn't provide this info, default to false
        }));

        // Insert in batches
        const BATCH_SIZE = 100;
        let insertedCount = 0;
        for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
          const batch = assignments.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await supabase
            .from('bunk_staff')
            .insert(batch);

          if (insertError) {
            console.error('[Staff Bunks] Error inserting batch:', insertError);
          } else {
            insertedCount += batch.length;
          }
        }

        console.log(`[Staff Bunks] Synced ${insertedCount} staff bunk assignments from CampMinder`);
      }
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

      // Use parallel batch updates for efficiency (avoid timeout with 500+ campers)
      const BATCH_SIZE = 50;
      for (let i = 0; i < sessionUpdates.length; i += BATCH_SIZE) {
        const batch = sessionUpdates.slice(i, i + BATCH_SIZE);
        
        // Execute batch updates in parallel
        await Promise.all(
          batch.map(update => 
            supabase
              .from('children')
              .update({ session: update.session })
              .eq('company_id', companyId)
              .eq('person_id', update.person_id)
              .eq('season', season)
          )
        );
        
        if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= sessionUpdates.length) {
          console.log(`Updated sessions: ${Math.min(i + BATCH_SIZE, sessionUpdates.length)}/${sessionUpdates.length}`);
        }
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

    // =====================================================
    // PHASE 10: Financial Sync - Owl Pay Balances from CampMinder
    // =====================================================
    let financialDeposits = 0;
    let financialReversals = 0;
    let financialSkipped = 0;

    if (syncType === 'full' || syncType === 'campers') {
      console.log('\n--- SYNCING FINANCIALS (Owl Pay Balances) ---');
      await updateSyncJob(supabase, jobId, {
        progress: { step: 'Syncing financial transactions for Owl Pay', season },
      });

      try {
        // Canteen spending money category ID
        const CANTEEN_CATEGORY_ID = '9076';

        const financialTransactions = await fetchAllPaginated(
          CM_FINANCIALS_URL,
          token,
          subscriptionKey,
          { clientid: clientId, categoryid: CANTEEN_CATEGORY_ID }
        );

        console.log(`[Financials] Found ${financialTransactions.length} canteen transactions from CampMinder`);

        if (financialTransactions.length > 0) {
          // Get already-synced transaction IDs to avoid double-counting
          const { data: existingSynced } = await supabase
            .from('campminder_transactions')
            .select('cm_transaction_id')
            .eq('company_id', companyId);

          const syncedIds = new Set((existingSynced || []).map((t: any) => t.cm_transaction_id));

          // Build a person_id -> child_id map from our camper data
          const { data: allCampers } = await supabase
            .from('children')
            .select('id, person_id, owl_pay_balance')
            .eq('company_id', companyId)
            .eq('season', season);

          const personToChildMap = new Map<string, { id: string; balance: number }>();
          (allCampers || []).forEach((c: any) => {
            personToChildMap.set(String(c.person_id), { id: c.id, balance: Number(c.owl_pay_balance) });
          });

          // Process new transactions
          const newTransactions: any[] = [];
          const balanceAdjustments = new Map<string, number>(); // child_id -> total adjustment

          for (const tx of financialTransactions) {
            const txId = String(tx.TransactionID || tx.Id || tx.transactionId || '');
            if (!txId || syncedIds.has(txId)) {
              financialSkipped++;
              continue;
            }

            const personId = String(tx.PersonID || tx.personId || tx.PersonId || '');
            const amount = Number(tx.Amount || tx.amount || 0);
            const isReversed = tx.IsReversed || tx.isReversed || tx.Reversed || false;
            const isDeleted = tx.IsDeleted || tx.isDeleted || tx.Deleted || false;

            const child = personToChildMap.get(personId);
            if (!child) {
              console.log(`[Financials] Skipping tx ${txId} - person ${personId} not found as camper`);
              financialSkipped++;
              continue;
            }

            let adjustAmount = Math.abs(amount);
            let txType = 'deposit';

            if (isReversed || isDeleted) {
              adjustAmount = -Math.abs(amount);
              txType = 'reversal';
              financialReversals++;
            } else {
              financialDeposits++;
            }

            // Accumulate adjustments per child
            const currentAdj = balanceAdjustments.get(child.id) || 0;
            balanceAdjustments.set(child.id, currentAdj + adjustAmount);

            newTransactions.push({
              company_id: companyId,
              cm_transaction_id: txId,
              person_id: personId,
              amount: adjustAmount,
              transaction_type: txType,
            });
          }

          // Batch insert new transaction records
          if (newTransactions.length > 0) {
            const batchSize = 50;
            for (let i = 0; i < newTransactions.length; i += batchSize) {
              const batch = newTransactions.slice(i, i + batchSize);
              const { error: insertError } = await supabase
                .from('campminder_transactions')
                .insert(batch);
              if (insertError) {
                console.error(`[Financials] Error inserting transaction batch:`, insertError);
              }
            }
          }

          // Apply balance adjustments atomically via RPC
          for (const [childId, adjustment] of balanceAdjustments.entries()) {
            if (adjustment === 0) continue;
            const { error: rpcError } = await supabase
              .rpc('increment_camper_balance', { _child_id: childId, _amount: adjustment });
            if (rpcError) {
              console.error(`[Financials] Error adjusting balance for ${childId}:`, rpcError);
            }
          }

          console.log(`[Financials] Processed: ${financialDeposits} deposits, ${financialReversals} reversals, ${financialSkipped} skipped (already synced or no match)`);
          console.log(`[Financials] Balance adjustments applied to ${balanceAdjustments.size} campers`);
        }
      } catch (finError) {
        console.error('[Financials] Error during financial sync:', finError);
      }
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
      financial_deposits: financialDeposits,
      financial_reversals: financialReversals,
      financial_skipped: financialSkipped,
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
