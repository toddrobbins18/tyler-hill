// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-ignore
declare const Deno: any;

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
/** Parallel in-flight person fetches — keeps total runtime under Edge Function limits for ~600 campers. */
const PERSON_FETCH_CONCURRENCY = 8;
let lastApiCallTime = 0;
let rateLimitTail: Promise<void> = Promise.resolve();

/** Serialize API call starts while allowing multiple in-flight responses. */
async function acquireRateLimitSlot(): Promise<void> {
  const prev = rateLimitTail;
  let release!: () => void;
  rateLimitTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  const now = Date.now();
  const waitTime = Math.max(0, RATE_LIMIT_DELAY_MS - (now - lastApiCallTime));
  if (waitTime > 0) await delay(waitTime);
  lastApiCallTime = Date.now();
  release();
}

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

/** Normalize CampMinder / form DOB values to YYYY-MM-DD for Postgres `date`. */
function normalizeDateOfBirthForDb(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (raw.includes('T')) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }

  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }

  return null;
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

/** Extra cushion after CampMinder says "Try again in N seconds" */
function parseCampminder429WaitMs(responseText: string, response: Response): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const sec = parseInt(retryAfter, 10);
    if (Number.isFinite(sec) && sec > 0) return Math.min(sec * 1000 + 1000, 120_000);
  }
  try {
    const j = JSON.parse(responseText);
    const msg = String(j.message || j.Message || '');
    const m = msg.match(/(\d+)\s*seconds?/i);
    if (m) return Math.min(parseInt(m[1], 10) * 1000 + 1000, 120_000);
  } catch {
    /* ignore */
  }
  return 12_000;
}

async function getJwtToken(subscriptionKey: string, apiKey: string): Promise<{ token: string; clientIds: string[] }> {
  const maxAttempts = 8;
  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Authenticating with CampMinder (attempt ${attempt}/${maxAttempts})...`);

    const authResponse = await rateLimitedFetch(CM_AUTH_URL, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    const responseText = await authResponse.text();

    if (authResponse.status === 429) {
      const waitMs = parseCampminder429WaitMs(responseText, authResponse);
      console.warn(`[Auth] HTTP 429 — backing off ${waitMs}ms before retry`);
      await delay(waitMs);
      lastError = responseText.substring(0, 300);
      continue;
    }

    const contentType = authResponse.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new Error(`CampMinder returned non-JSON response (status ${authResponse.status}): ${responseText.substring(0, 200)}`);
    }

    let authData: any;
    try {
      authData = JSON.parse(responseText);
    } catch {
      throw new Error(`Failed to parse CampMinder response: ${responseText.substring(0, 200)}`);
    }

    if (authData.statusCode === 429) {
      const waitMs = parseCampminder429WaitMs(responseText, authResponse);
      console.warn(`[Auth] JSON 429 — backing off ${waitMs}ms before retry`);
      await delay(waitMs);
      lastError = authData.message || JSON.stringify(authData);
      continue;
    }

    if (!authResponse.ok || !authData.Token) {
      lastError = authData.Message || authData.error || JSON.stringify(authData);
      throw new Error(`Authentication failed: ${lastError}`);
    }

    const clientIds = authData.ClientIDs ? String(authData.ClientIDs).split(',').map((id: string) => id.trim()) : [];
    console.log(`Authenticated successfully. ClientIDs: ${clientIds.join(', ')}`);

    return { token: authData.Token, clientIds };
  }

  throw new Error(`Authentication failed after ${maxAttempts} attempts (rate limited): ${lastError}`);
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

/** SessionProgramStatus StatusID 2 = enrolled on that session/program in CampMinder. */
function attendeeHasEnrolledSessionProgram(attendee: any): boolean {
  const programs = attendee?.SessionProgramStatus;
  if (!Array.isArray(programs) || programs.length === 0) return false;
  return programs.some((s: any) => Number(s?.StatusID) === 2);
}

function mergeSessionAttendee(existing: any | undefined, attendee: any): any {
  const pick = (a: unknown, b: unknown) =>
    a != null && String(a).trim() !== '' ? a : b;

  if (!existing) {
    return {
      PersonID: String(attendee.PersonID),
      FirstName: attendee.FirstName || attendee.Name?.First || '',
      LastName: attendee.LastName || attendee.Name?.Last || '',
      GenderID: attendee.GenderID,
      DateOfBirth: attendee.DateOfBirth,
      DivisionID: attendee.DivisionID,
      SessionProgramStatus: attendee.SessionProgramStatus,
      BunkID: attendee.BunkID || null,
      BunkPlanID: attendee.BunkPlanID || null,
    };
  }

  return {
    ...existing,
    FirstName: pick(existing.FirstName, attendee.FirstName || attendee.Name?.First),
    LastName: pick(existing.LastName, attendee.LastName || attendee.Name?.Last),
    GenderID: existing.GenderID ?? attendee.GenderID,
    DateOfBirth: existing.DateOfBirth || attendee.DateOfBirth,
    DivisionID: existing.DivisionID ?? attendee.DivisionID,
    SessionProgramStatus: existing.SessionProgramStatus?.length
      ? existing.SessionProgramStatus
      : attendee.SessionProgramStatus,
    BunkID: existing.BunkID ?? attendee.BunkID ?? null,
    BunkPlanID: existing.BunkPlanID ?? attendee.BunkPlanID ?? null,
  };
}

/**
 * Build the enrolled camper list for a season.
 * The status=2 filter alone can under-count (e.g. Timber Lake Camp ~351 vs ~462 in CampMinder UI)
 * when enrollment is recorded on SessionProgramStatus but not the top-level attendee status filter.
 */
async function fetchEnrolledSessionAttendees(
  token: string,
  subscriptionKey: string,
  clientId: string,
  season: string,
): Promise<{
  attendees: any[];
  stats: { status2Rows: number; allRows: number; uniqueEnrolled: number; addedFromAllRows: number };
}> {
  const status2Rows = await fetchAllPaginated(
    `${CM_SESSIONS_URL}/attendees`,
    token,
    subscriptionKey,
    { clientid: clientId, seasonid: season, status: 2 },
  );

  const allRows = await fetchAllPaginated(
    `${CM_SESSIONS_URL}/attendees`,
    token,
    subscriptionKey,
    { clientid: clientId, seasonid: season },
  );

  const enrolledByPerson = new Map<string, any>();

  for (const attendee of status2Rows) {
    if (!attendee?.PersonID) continue;
    const pid = String(attendee.PersonID);
    enrolledByPerson.set(pid, mergeSessionAttendee(enrolledByPerson.get(pid), attendee));
  }

  let addedFromAllRows = 0;
  for (const attendee of allRows) {
    if (!attendee?.PersonID) continue;
    const pid = String(attendee.PersonID);
    if (enrolledByPerson.has(pid)) {
      enrolledByPerson.set(pid, mergeSessionAttendee(enrolledByPerson.get(pid), attendee));
      continue;
    }
    if (attendeeHasEnrolledSessionProgram(attendee)) {
      enrolledByPerson.set(pid, mergeSessionAttendee(undefined, attendee));
      addedFromAllRows++;
    }
  }

  const attendees = Array.from(enrolledByPerson.values());
  const stats = {
    status2Rows: status2Rows.length,
    allRows: allRows.length,
    uniqueEnrolled: attendees.length,
    addedFromAllRows,
  };

  console.log(
    `[Enrolled Attendees] status=2 rows: ${stats.status2Rows}, all rows: ${stats.allRows}, ` +
      `unique enrolled: ${stats.uniqueEnrolled} (+${stats.addedFromAllRows} from SessionProgramStatus on unfiltered fetch)`,
  );

  return { attendees, stats };
}

// Fetch a single person by ID with full details
async function fetchPersonById(
  personId: string,
  token: string,
  subscriptionKey: string,
  clientId: string
): Promise<any | null> {
  await acquireRateLimitSlot();
  try {
    const url = `${CM_PERSONS_URL}/${personId}?clientid=${clientId}&includecamperdetails=true&includecontactdetails=true&includerelatives=true&includestaffdetails=true`;
    const response = await fetch(url, {
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

/** Fetch many person records with limited concurrency (respects acquireRateLimitSlot). */
async function fetchPersonsInParallel(
  personIds: string[],
  personMap: Map<string, any>,
  token: string,
  subscriptionKey: string,
  clientId: string,
  options?: {
    label?: string;
    requireName?: boolean;
    onProgress?: (done: number, total: number, ok: number, fail: number) => Promise<void>;
  },
): Promise<{ fetched: number; failed: number }> {
  if (personIds.length === 0) return { fetched: 0, failed: 0 };

  const label = options?.label ?? 'Person';
  const requireName = options?.requireName ?? false;
  let nextIndex = 0;
  let done = 0;
  let fetched = 0;
  let failed = 0;

  console.log(`\n[${label}] Fetching ${personIds.length} persons (${PERSON_FETCH_CONCURRENCY} concurrent)...`);

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= personIds.length) break;

      const personId = personIds[i];
      const person = await fetchPersonById(personId, token, subscriptionKey, clientId);
      const ok = !!person && (!requireName || !!person.Name);

      if (ok) {
        personMap.set(personId, person);
        fetched++;
        if (fetched <= 5) {
          const name = `${person.Name?.First || ''} ${person.Name?.Last || ''}`.trim();
          console.log(`[${label}] Fetched ${personId}: ${name || personId}`);
        }
      } else {
        failed++;
      }

      done++;
      if (options?.onProgress && (done % 25 === 0 || done === personIds.length)) {
        await options.onProgress(done, personIds.length, fetched, failed);
      }
    }
  }

  const workers = Math.min(PERSON_FETCH_CONCURRENCY, personIds.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  console.log(`[${label}] Completed: ${fetched} fetched, ${failed} failed out of ${personIds.length}`);
  return { fetched, failed };
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
  return fetchPersonsInParallel(missingIds, personMap, token, subscriptionKey, clientId, {
    label: entityType,
    requireName: true,
    onProgress: async (done, total, ok, fail) => {
      console.log(`[${entityType}] Fetch progress: ${done}/${total} (${ok} success, ${fail} failed)`);
    },
  });
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

/** Edge timeouts often kill waitUntil work without running catch — jobs stay "running" forever. */
async function failStaleCampminderSyncJobs(
  supabase: any,
  companyId: string,
  staleMinutes: number = 120,
): Promise<number> {
  const cutoffIso = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();
  const msg =
    `Stale job auto-closed after ${staleMinutes}m (Edge worker timeout or crash — run sync again).`;

  // Pending: never left "pending" (worker died before performFullSync marked running).
  const { data: stalePending, error: pendErr } = await supabase
    .from('sync_jobs')
    .select('id')
    .eq('company_id', companyId)
    .eq('entity_type', 'campminder')
    .eq('status', 'pending')
    .lt('created_at', cutoffIso);

  // Running: no progress heartbeat (updated_at) — long camper fetch used to die here when only created_at mattered.
  const { data: staleRunning, error: runErr } = await supabase
    .from('sync_jobs')
    .select('id')
    .eq('company_id', companyId)
    .eq('entity_type', 'campminder')
    .eq('status', 'running')
    .lt('updated_at', cutoffIso);

  if (pendErr || runErr) {
    console.error('failStaleCampminderSyncJobs:', pendErr || runErr);
    return 0;
  }

  const idSet = new Set<string>();
  (stalePending || []).forEach((r: { id: string }) => idSet.add(r.id));
  (staleRunning || []).forEach((r: { id: string }) => idSet.add(r.id));
  const ids = [...idSet];
  if (ids.length === 0) return 0;

  const { error: updErr } = await supabase
    .from('sync_jobs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: msg,
    })
    .in('id', ids);

  if (updErr) {
    console.error('failStaleCampminderSyncJobs update:', updErr);
    return 0;
  }
  console.log(`[Stale sync jobs] Marked ${ids.length} job(s) failed for company ${companyId}`);
  return ids.length;
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

/** Per-company Owl Pay / canteen sync configuration sourced from `companies`. */
interface OwlPayConfig {
  enabled: boolean;
  categoryIds: string[];
  descriptionKeywords: string[];
}

async function syncOwlPayBalancesFromCampminder(
  supabase: any,
  jobId: string,
  companyId: string,
  token: string,
  subscriptionKey: string,
  clientId: string,
  season: string,
  config: OwlPayConfig,
): Promise<{ financialDeposits: number; financialReversals: number; financialSkipped: number; financialUpdated: number }> {
  let financialDeposits = 0;
  let financialReversals = 0;
  let financialSkipped = 0;
  let financialUpdated = 0;

  console.log('\n--- SYNCING FINANCIALS (Owl Pay Balances) ---');
  await updateSyncJob(supabase, jobId, {
    progress: { step: 'Syncing financial transactions for Owl Pay', season },
  });

  // Defensive: skip silently if a caller forgot to gate, or config is empty.
  if (!config.enabled) {
    console.log(`[Financials] owl_pay_enabled=false for company ${companyId} — skipping financials sync.`);
    return { financialDeposits, financialReversals, financialSkipped, financialUpdated };
  }
  const categoryIdSet = new Set((config.categoryIds || []).map((s) => String(s).trim()).filter(Boolean));
  const descriptionKeywords = (config.descriptionKeywords || [])
    .map((s) => String(s).toLowerCase().trim())
    .filter(Boolean);
  if (categoryIdSet.size === 0 && descriptionKeywords.length === 0) {
    console.warn(
      `[Financials] owl_pay_enabled=true but neither category ids nor description keywords are configured for company ${companyId} — skipping to avoid syncing every transaction.`,
    );
    return { financialDeposits, financialReversals, financialSkipped, financialUpdated };
  }

  try {
    // Pass categoryid as a server-side hint only when a single id is configured;
    // when multiple ids (or none) are in play we always filter client-side anyway,
    // because CampMinder does not consistently honour the categoryid query param.
    const fetchParams: Record<string, string | number | boolean> = {
      clientid: clientId,
      season: season,
    };
    if (categoryIdSet.size === 1) {
      fetchParams.categoryid = [...categoryIdSet][0];
    }

    const allFinancialTransactions = await fetchAllPaginated(
      CM_FINANCIALS_URL,
      token,
      subscriptionKey,
      fetchParams,
    );

    console.log(`[Financials] Fetched ${allFinancialTransactions.length} total financial transactions from CampMinder`);
    console.log(
      `[Financials] Filter config: categoryIds=${JSON.stringify([...categoryIdSet])}, descriptionKeywords=${JSON.stringify(descriptionKeywords)}`,
    );

    // Log a sample to help debug field names
    if (allFinancialTransactions.length > 0) {
      console.log(`[Financials DEBUG] Sample transaction keys: ${JSON.stringify(Object.keys(allFinancialTransactions[0]))}`);
      console.log(`[Financials DEBUG] Sample transaction: ${JSON.stringify(allFinancialTransactions[0]).substring(0, 2000)}`);
    }

    // Helper to get field value with inconsistent casing from CampMinder
    const getFieldEarly = (obj: any, ...names: string[]): any => {
      for (const name of names) {
        if (obj[name] !== undefined) return obj[name];
        const lower = name.toLowerCase();
        const upper = name.charAt(0).toUpperCase() + name.slice(1);
        const allCaps = name.toUpperCase();
        if (obj[lower] !== undefined) return obj[lower];
        if (obj[upper] !== undefined) return obj[upper];
        if (obj[allCaps] !== undefined) return obj[allCaps];
      }
      const lowerNames = names.map(n => n.toLowerCase());
      for (const key of Object.keys(obj)) {
        if (lowerNames.includes(key.toLowerCase())) return obj[key];
      }
      return undefined;
    };

    // Client-side filter using the per-company Owl Pay configuration.
    const financialTransactions = allFinancialTransactions.filter((tx: any) => {
      const catId = String(getFieldEarly(tx, 'financialCategoryId', 'FinancialCategoryId', 'FinancialCategoryID', 'categoryId', 'CategoryId', 'CategoryID') || '');
      if (catId && categoryIdSet.has(catId)) return true;

      if (descriptionKeywords.length > 0) {
        const desc = String(getFieldEarly(tx, 'description', 'Description') || '').toLowerCase();
        if (desc && descriptionKeywords.some((kw) => desc.includes(kw))) return true;
      }
      return false;
    });

    console.log(`[Financials] After Owl Pay filter: ${financialTransactions.length} of ${allFinancialTransactions.length} transactions`);

    if (financialTransactions.length > 0) {
      // Existing ledger rows (same CM transaction id can change when CM reverses/cancels)
      const { data: existingSyncedRows } = await supabase
        .from('campminder_transactions')
        .select('cm_transaction_id, amount, person_id')
        .eq('company_id', companyId);

      const existingByTxId = new Map<string, { amount: number; person_id: string }>();
      (existingSyncedRows || []).forEach((t: any) => {
        existingByTxId.set(String(t.cm_transaction_id), {
          amount: Number(t.amount),
          person_id: String(t.person_id || ''),
        });
      });

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
      const seasonTxById = new Map<string, { personId: string; contribution: number }>();

      // Helper to get field value with inconsistent casing from CampMinder
      const getField = (obj: any, ...names: string[]): any => {
        for (const name of names) {
          // Try exact match first
          if (obj[name] !== undefined) return obj[name];
          // Try common casing variants
          const lower = name.toLowerCase();
          const upper = name.charAt(0).toUpperCase() + name.slice(1);
          const allCaps = name.toUpperCase();
          if (obj[lower] !== undefined) return obj[lower];
          if (obj[upper] !== undefined) return obj[upper];
          if (obj[allCaps] !== undefined) return obj[allCaps];
        }
        // Last resort: case-insensitive search through all keys
        const lowerNames = names.map(n => n.toLowerCase());
        for (const key of Object.keys(obj)) {
          if (lowerNames.includes(key.toLowerCase())) return obj[key];
        }
        return undefined;
      };

      // Log first transaction to discover field names
      if (financialTransactions.length > 0) {
        const sample = financialTransactions[0];
        console.log(`[Financials DEBUG] First tx keys: ${JSON.stringify(Object.keys(sample))}`);
        console.log(`[Financials DEBUG] First tx full: ${JSON.stringify(sample).substring(0, 2000)}`);
        const personVal = getField(sample, 'personId', 'PersonId', 'PersonID');
        console.log(`[Financials DEBUG] getField personId result: ${personVal}`);
      }

      const parseBool = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
          const v = value.trim().toLowerCase();
          return ['1', 'true', 'yes', 'y'].includes(v);
        }
        return false;
      };

      for (const tx of financialTransactions) {
        const txId = String(getField(tx, 'transactionId', 'TransactionId', 'TransactionID', 'Id', 'ID') || '');
        if (!txId) {
          financialSkipped++;
          continue;
        }

        const personId = String(getField(tx, 'personId', 'PersonId', 'PersonID') || '');
        const amount = Number(getField(tx, 'amount', 'Amount') || 0);
        const isReversed = parseBool(getField(tx, 'isReversed', 'IsReversed', 'Reversed', 'isReversal', 'IsReversal'));
        const isDeleted = parseBool(getField(tx, 'isDeleted', 'IsDeleted', 'Deleted'));
        const isCancelled = parseBool(getField(tx, 'isCancelled', 'IsCancelled', 'Cancelled', 'Canceled', 'isCanceled', 'IsCanceled'));
        const isVoided = parseBool(getField(tx, 'isVoided', 'IsVoided', 'Voided'));
        const isActiveField = getField(tx, 'isActive', 'IsActive', 'Active');
        const isInactive = isActiveField !== undefined ? !parseBool(isActiveField) : false;
        const markerRaw = [
          getField(tx, 'status', 'Status', 'transactionStatus', 'TransactionStatus'),
          getField(tx, 'description', 'Description'),
          getField(tx, 'notes', 'Notes', 'comment', 'Comment'),
          getField(tx, 'transactionType', 'TransactionType', 'type', 'Type'),
        ]
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v).toLowerCase())
          .join(' | ');
        const statusIndicatesVoid = ['void', 'voided', 'cancel', 'cancelled', 'canceled', 'reversed', 'reverse', 'deleted', 'refund', 'declined', 'failed'].some((k) =>
          markerRaw.includes(k)
        );
        const reversed = isReversed || isDeleted || isCancelled || isVoided || isInactive || statusIndicatesVoid;

        const child = personToChildMap.get(personId);
        if (!child) {
          console.log(`[Financials] Skipping tx ${txId} - person ${personId} not found as camper`);
          financialSkipped++;
          continue;
        }

        const absAmt = Math.abs(amount);
        const existingRow = existingByTxId.get(txId);
        const oldContribution = existingRow !== undefined ? Number(existingRow.amount) : null;

        /** Net effect of this CM row on our ledger (one row per cm_transaction_id). */
        let newContribution: number;
        if (reversed) {
          // Two CM reversal patterns:
          // 1) Same transaction id later marked reversed/cancelled -> zero prior contribution.
          // 2) Separate reversal transaction id -> apply a negative amount to offset deposits.
          newContribution = oldContribution !== null ? 0 : -absAmt;
        } else {
          newContribution = absAmt;
        }

        // Track season snapshot from CampMinder payload itself (latest row per tx id).
        seasonTxById.set(txId, { personId, contribution: newContribution });

        if (oldContribution !== null) {
          const delta = newContribution - oldContribution;
          if (Math.abs(delta) < 0.0001) {
            financialSkipped++;
            continue;
          }

          const txType =
            newContribution < 0 ? 'reversal' : newContribution > 0 ? 'deposit' : 'reversal';
          const { error: updErr } = await supabase
            .from('campminder_transactions')
            .update({
              amount: newContribution,
              person_id: personId,
              transaction_type: txType,
              synced_at: new Date().toISOString(),
            })
            .eq('company_id', companyId)
            .eq('cm_transaction_id', txId);

          if (updErr) {
            console.error(`[Financials] Error updating transaction ${txId}:`, updErr);
            continue;
          }

          const currentAdj = balanceAdjustments.get(child.id) || 0;
          balanceAdjustments.set(child.id, currentAdj + delta);
          financialUpdated++;
          if (delta < 0) financialReversals++;
          else financialDeposits++;
          console.log(
            `[Financials] Updated tx ${txId}: ledger ${oldContribution} → ${newContribution} (balance delta ${delta})`
          );
          continue;
        }

        if (Math.abs(newContribution) < 0.0001) {
          financialSkipped++;
          continue;
        }

        const txType = newContribution < 0 ? 'reversal' : 'deposit';
        if (txType === 'reversal') financialReversals++;
        else financialDeposits++;

        const currentAdj = balanceAdjustments.get(child.id) || 0;
        balanceAdjustments.set(child.id, currentAdj + newContribution);

        newTransactions.push({
          company_id: companyId,
          cm_transaction_id: txId,
          person_id: personId,
          amount: newContribution,
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

      // Reconciliation guard (season-scoped):
      // Expected balance = CampMinder deposits (current season payload) minus Owl Pay purchases.
      // Do NOT set balance to deposits alone — that wipes POS deductions after each sync.
      // Full accounting balance = CM deposits minus Owl Pay purchases (no cap on stored balance).
      // Checkout RPC still blocks new purchases below -$75 credit limit.
      const sumByPerson = new Map<string, number>();
      for (const { personId, contribution } of seasonTxById.values()) {
        const prev = sumByPerson.get(personId) || 0;
        sumByPerson.set(personId, prev + Number(contribution || 0));
      }

      const spendByChild = new Map<string, number>();
      const { data: spendTotals, error: spendErr } = await supabase.rpc(
        'get_owl_pay_purchase_totals',
        { _company_id: companyId },
      );
      if (spendErr) {
        console.error('[Financials] Error loading Owl Pay purchase totals for reconciliation:', spendErr);
      } else {
        for (const row of spendTotals || []) {
          spendByChild.set(String(row.child_id), Number(row.total_spent || 0));
        }
      }

      const { data: seasonCampers, error: campersErr } = await supabase
        .from('children')
        .select('id, person_id, owl_pay_balance')
        .eq('company_id', companyId)
        .eq('season', season);

      if (campersErr) {
        console.error('[Financials] Error loading campers for reconciliation:', campersErr);
      } else {
        const updates = (seasonCampers || [])
          .map((c: any) => {
            const cmDeposits = Number(sumByPerson.get(String(c.person_id || '')) || 0);
            const spent = spendByChild.get(String(c.id)) || 0;
            const expected = cmDeposits - spent;
            const current = Number(c.owl_pay_balance || 0);
            return { id: c.id, expected, current };
          })
          .filter((x: any) => Math.abs(x.expected - x.current) > 0.0001);

        for (const u of updates) {
          const { error: updateErr } = await supabase
            .from('children')
            .update({ owl_pay_balance: u.expected, updated_at: new Date().toISOString() })
            .eq('id', u.id);
          if (updateErr) {
            console.error(`[Financials] Reconciliation update failed for child ${u.id}:`, updateErr);
          }
        }

        if (updates.length > 0) {
          console.log(
            `[Financials] Reconciled ${updates.length} camper balances (CM deposits minus Owl Pay purchases)`,
          );
        }
      }

      console.log(
        `[Financials] Processed: ${financialDeposits} deposits, ${financialReversals} reversals, ${financialUpdated} updated rows, ${financialSkipped} unchanged/skipped`
      );
      console.log(`[Financials] Balance adjustments applied to ${balanceAdjustments.size} campers`);
    }
  } catch (finError) {
    console.error('[Financials] Error during financial sync:', finError);
  }

  return { financialDeposits, financialReversals, financialSkipped, financialUpdated };
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
  syncType: string = 'full',
  owlPayConfig: OwlPayConfig = { enabled: false, categoryIds: [], descriptionKeywords: [] },
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

    const season = seasonId ? String(seasonId) : '2026';
    console.log(`\n[Season] Using season: ${season}\n`);
    
    await updateSyncJob(supabase, jobId, {
      progress: { step: 'Season detected', season, syncType: isIncremental ? 'incremental' : 'full' },
    });

    if (syncType === 'financials') {
      // Hard gate: a `sync_type=financials` invoke against a company with Owl Pay
      // disabled completes immediately with `skipped_owl_pay_disabled` instead
      // of touching the CampMinder financials API or `children.owl_pay_balance`.
      if (!owlPayConfig.enabled) {
        console.log(
          `[Financials-only] owl_pay_enabled=false for company ${companyId} — skipping financials sync.`,
        );
        await updateSyncJob(supabase, jobId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress: {
            step: 'Skipped (Owl Pay disabled for this company)',
            syncType: 'financials_only',
            skipped_owl_pay_disabled: true,
            season,
          },
          total_counts: {
            financial_deposits: 0,
            financial_reversals: 0,
            financial_skipped: 0,
            financial_updated: 0,
          },
        });
        return;
      }

      let financialDeposits = 0;
      let financialReversals = 0;
      let financialSkipped = 0;
      let financialUpdated = 0;
      try {
        const fin = await syncOwlPayBalancesFromCampminder(
          supabase,
          jobId,
          companyId,
          token,
          subscriptionKey,
          clientId,
          season,
          owlPayConfig,
        );
        financialDeposits = fin.financialDeposits;
        financialReversals = fin.financialReversals;
        financialSkipped = fin.financialSkipped;
        financialUpdated = fin.financialUpdated;
      } catch (finError) {
        console.error('[Financials-only] Error during Owl Pay sync:', finError);
      }

      const { error: lastSyncErrFin } = await supabase
        .from('companies')
        .update({ campminder_last_sync_at: new Date().toISOString() })
        .eq('id', companyId);
      if (lastSyncErrFin) {
        console.error('[Companies] Failed to update campminder_last_sync_at:', lastSyncErrFin);
      }

      await updateSyncJob(supabase, jobId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: {
          step: 'Completed',
          syncType: 'financials_only',
          financial_deposits: financialDeposits,
          financial_reversals: financialReversals,
          financial_skipped: financialSkipped,
          financial_updated: financialUpdated,
          season,
        },
        total_counts: {
          financial_deposits: financialDeposits,
          financial_reversals: financialReversals,
          financial_skipped: financialSkipped,
          financial_updated: financialUpdated,
        },
      });

      console.log('\n========================================');
      console.log(`Owl Pay / financials-only sync completed for company ${companyId}`);
      console.log('========================================\n');
      return;
    }

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

      const enrolledFetch = await fetchEnrolledSessionAttendees(
        token,
        subscriptionKey,
        clientId,
        season,
      );
      enrolledAttendees = enrolledFetch.attendees;
      console.log(`Found ${enrolledAttendees.length} unique enrolled campers`);

      if (enrolledAttendees.length > 0) {
        console.log('[DEBUG] Sample session attendee record:', JSON.stringify(enrolledAttendees[0], null, 2));
      }

      await updateSyncJob(supabase, jobId, {
        progress: {
          step: 'Enrolled attendees loaded',
          enrolledStatus2Rows: enrolledFetch.stats.status2Rows,
          allAttendeeRows: enrolledFetch.stats.allRows,
          enrolledCampers: enrolledFetch.stats.uniqueEnrolled,
          enrolledAddedFromAllRows: enrolledFetch.stats.addedFromAllRows,
          season,
          syncType,
        },
      });

      // Build a map of attendee data for fallback (merge duplicates across sessions)
      for (const attendee of enrolledAttendees) {
        const personId = String(attendee.PersonID);
        attendeeDataMap.set(
          personId,
          mergeSessionAttendee(attendeeDataMap.get(personId), attendee),
        );
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

      const camperFetch = await fetchPersonsInParallel(
        enrolledPersonIdArray,
        personMap,
        token,
        subscriptionKey,
        clientId,
        {
          label: 'Camper Fetch',
          requireName: false,
          onProgress: async (done, total, ok, fail) => {
            fetchedCount = ok;
            failedCount = fail;
            if (done % 100 === 0 || done === total) {
              console.log(`[Camper Fetch] Progress: ${done}/${total} (${ok} success, ${fail} failed)`);
            }
            if (done % 50 === 0 || done === total) {
              await updateSyncJob(supabase, jobId, {
                progress: {
                  step: 'Fetching camper person data',
                  camper_fetch_index: done,
                  camper_fetch_total: total,
                  camper_fetch_ok: ok,
                  camper_fetch_failed: fail,
                  enrolledCampers: total,
                  divisions: divisions.length,
                  season,
                  syncType,
                },
              });
            }
          },
        },
      );
      fetchedCount = camperFetch.fetched;
      failedCount = camperFetch.failed;

      const firstWithRelatives = enrolledPersonIdArray
        .map((id) => personMap.get(id))
        .find((p) => p?.Relatives?.length);
      if (firstWithRelatives) {
        console.log('[DEBUG] Sample camper with Relatives:', JSON.stringify({
          ID: firstWithRelatives.ID,
          Name: firstWithRelatives.Name,
          Relatives: firstWithRelatives.Relatives,
          ContactDetails: firstWithRelatives.ContactDetails,
        }, null, 2));
      }

      console.log(`Built person map with ${personMap.size} camper entries`);

      // Identify missing campers
      for (const personId of enrolledPersonIdArray) {
        if (!personMap.has(personId)) {
          missingCamperIds.push(personId);
        }
      }

      // Include all fetched enrolled persons — CamperDetails may be missing on some valid campers;
      // division/grade fall back to session attendee data in Phase 6.
      let campersWithoutCamperDetails = 0;
      for (const personId of enrolledPersonIdArray) {
        const person = personMap.get(personId);
        if (person) {
          if (!person.CamperDetails) campersWithoutCamperDetails++;
          campers.push(person);
        }
      }

      console.log(`✓ Total enrolled campers in personMap: ${campers.length} (${campersWithoutCamperDetails} without CamperDetails)`);
      console.log(`  Missing camper IDs (person fetch failed): ${missingCamperIds.length}`);
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
      console.log(`[Camper Sync] ${enrolledPersonIdArray.length} enrolled in CampMinder, ${campers.length} in personMap, ${missingCamperIds.length} person fetches failed`);

      await updateSyncJob(supabase, jobId, {
        progress: { step: 'Syncing campers', total: enrolledPersonIdArray.length, divisions: divisions.length, parentEmails: parentEmailMap.size, season },
        total_counts: { divisions: divisions.length, campers: enrolledPersonIdArray.length },
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
      
      let gender: string | null = null;
      if (person.GenderID === 0) gender = 'Female';
      else if (person.GenderID === 1) gender = 'Male';
      
      const attendeeRow = attendeeDataMap.get(String(person.ID));
      const grade = gradeMap[person.CamperDetails?.CampGradeID] ?? null;

      // Get parent contact info
      const parentPersonId = camperToParentMap.get(String(person.ID));
      let guardianEmail = parentPersonId ? parentEmailMap.get(parentPersonId) || '' : '';
      let guardianPhone = parentPersonId ? parentPhoneMap.get(parentPersonId) || '' : '';
      let guardianName = parentPersonId ? parentNameMap.get(parentPersonId) || '' : '';
      
      // Fallback to camper's ContactDetails for email if not found on parent
      if (!guardianEmail && person.ContactDetails?.Emails?.length > 0) {
        const emailObj = person.ContactDetails.Emails.find((e: any) => e.IsLogin || e.IsPrimary) || person.ContactDetails.Emails[0];
        if (emailObj && emailObj.Address) {
          guardianEmail = emailObj.Address;
        }
      }

      // Fallback to camper's ContactDetails for phone if not found on parent
      if (!guardianPhone && person.ContactDetails?.PhoneNumbers?.length > 0) {
        guardianPhone = person.ContactDetails.PhoneNumbers[0].Number;
      }

      // Prefer CamperDetails.DivisionID; fall back to session attendee when CamperDetails is absent.
      const cmDivisionId = person.CamperDetails?.DivisionID ?? attendeeRow?.DivisionID;
      const divisionId = cmDivisionId ? cmDivisionIdMap.get(cmDivisionId) : null;

      if (!divisionId && cmDivisionId) {
        console.log(`[Division Warning] Camper ${name} has DivisionID=${cmDivisionId} but no matching division in our DB`);
      }

      const cmBunkId = attendeeRow?.BunkID;
      const bunkId = cmBunkId ? cmBunkIdMap.get(cmBunkId) : null;
      
      if (cmBunkId && !bunkId) {
        console.log(`[Bunk Warning] Camper ${name} has BunkID=${cmBunkId} but no matching bunk in our DB`);
      }

      camperData.push({
        person_id: String(person.ID),
        name,
        gender,
        date_of_birth: normalizeDateOfBirthForDb(person.DateOfBirth),
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

    // Gap-fill: any enrolled camper not yet in camperData (person fetch failed OR missing CamperDetails/name in main loop)
    const camperDataPersonIds = new Set(camperData.map((c) => String(c.person_id)));
    let skippedEnrolledNoName = 0;

    for (const personId of enrolledPersonIdArray) {
      const personIdStr = String(personId);
      if (camperDataPersonIds.has(personIdStr)) continue;

      const fallbackData = attendeeDataMap.get(personIdStr);
      const person = personMap.get(personIdStr);
      const firstName = (person?.Name?.First || fallbackData?.FirstName || '').trim();
      const lastName = (person?.Name?.Last || fallbackData?.LastName || '').trim();

      if (!firstName || !lastName) {
        skippedEnrolledNoName++;
        if (skippedEnrolledNoName <= 5) {
          console.log(`[Camper Skip] Enrolled PersonID ${personIdStr} missing first or last name — skipping`);
        }
        continue;
      }

      const name = `${firstName} ${lastName}`;
      const genderSource = person ?? fallbackData;
      let gender: string | null = null;
      if (genderSource?.GenderID === 0) gender = 'Female';
      else if (genderSource?.GenderID === 1) gender = 'Male';

      const cmDivisionId = person?.CamperDetails?.DivisionID ?? fallbackData?.DivisionID;
      const divisionId = cmDivisionId ? cmDivisionIdMap.get(cmDivisionId) : null;
      const cmBunkId = fallbackData?.BunkID;
      const bunkId = cmBunkId ? cmBunkIdMap.get(cmBunkId) : null;

      camperData.push({
        person_id: personIdStr,
        name,
        gender,
        date_of_birth: normalizeDateOfBirthForDb(person?.DateOfBirth || fallbackData?.DateOfBirth),
        grade: gradeMap[person?.CamperDetails?.CampGradeID] ?? null,
        guardian_name: null,
        guardian_email: null,
        guardian_phone: null,
        allergies: person?.MedicalInfo?.Allergies || null,
        medical_notes: person?.MedicalInfo?.Notes || null,
        company_id: companyId,
        season: season,
        status: 'active',
        division_id: divisionId,
        bunk_id: bunkId,
      });

      camperDataPersonIds.add(personIdStr);
      usedCamperFallbackData++;
      if (usedCamperFallbackData <= 5) {
        console.log(`[Camper Fallback] Created record for ${name} (${personIdStr})`);
      }
    }

    if (skippedEnrolledNoName > 0) {
      console.warn(`[Campers] ${skippedEnrolledNoName} enrolled campers could not be synced (no name in person or attendee data)`);
    }

    console.log(`Built ${camperData.length} camper records (${usedCamperFallbackData} from fallback/gap-fill)`);
    
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
      // PHASE 6a: Reactivate campers still enrolled in CampMinder but marked inactive
      // (e.g. wrongly inactivated by prior partial syncs before cleanup fix)
      // =====================================================
      console.log('\n--- REACTIVATING ENROLLED CAMPERS ---');
      let reactivatedCount = 0;
      for (let i = 0; i < enrolledPersonIdArray.length; i += 100) {
        const batch = enrolledPersonIdArray.slice(i, i + 100).map(String);
        const { data: reactivatedRows, error: reactivateErr } = await supabase
          .from('children')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('company_id', companyId)
          .eq('season', season)
          .eq('status', 'inactive')
          .in('person_id', batch)
          .select('id');

        if (reactivateErr) {
          console.error('[Reactivate] Error:', reactivateErr.message);
        } else {
          reactivatedCount += reactivatedRows?.length || 0;
        }
      }
      console.log(`[Reactivate] Set ${reactivatedCount} inactive campers back to active (still enrolled in CampMinder)`);

      await updateSyncJob(supabase, jobId, {
        progress: {
          step: 'Campers synced',
          enrolledCampers: enrolledPersonIdArray.length,
          campersSynced: camperData.length,
          campersReactivated: reactivatedCount,
          season,
          syncType,
        },
      });

      // =====================================================
      // PHASE 6b: Mark dropped campers as inactive
      // Only inactivate when CampMinder enrolled list no longer includes them.
      // MUST use enrolledPersonIdArray (CampMinder truth), NOT camperData (sync subset).
      // Using camperData caused daily count swings when person fetches failed/timeouts occurred.
      // =====================================================
      console.log('\n--- CLEANING UP DROPPED CAMPERS ---');

      if (enrolledPersonIdArray.length === 0) {
        console.warn('[Camper Cleanup] Skipping inactivation — zero enrolled attendees from CampMinder (likely API error)');
      } else {
        const enrolledPersonIdSet = new Set(enrolledPersonIdArray.map(String));

        if (camperData.length > 0 && camperData.length < enrolledPersonIdArray.length * 0.85) {
          console.warn(
            `[Camper Cleanup] Sync built ${camperData.length} camper rows but CampMinder reports ${enrolledPersonIdArray.length} enrolled — inactivating only against enrolled list, not sync subset`,
          );
        }

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
            (c: any) => c.person_id && !enrolledPersonIdSet.has(String(c.person_id)),
          );

          console.log(
            `[Camper Cleanup] Found ${droppedCampers.length} campers to mark inactive (${existingCampers?.length || 0} active in DB, ${enrolledPersonIdSet.size} enrolled in CampMinder)`,
          );

          if (droppedCampers.length > 0) {
            droppedCampers.slice(0, 10).forEach((c: any) => {
              console.log(`  - Marking inactive: ${c.name} (person_id: ${c.person_id})`);
            });

            const droppedIds = droppedCampers.map((c: any) => c.id);

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

      await fetchPersonsInParallel(toFetch, personMap, token, subscriptionKey, clientId, {
        label: 'Staff Fetch',
        requireName: true,
        onProgress: async (done, total, ok, fail) => {
          if (done % 25 === 0 || done === total) {
            console.log(`[Staff Fetch] Progress: ${done}/${total} (${ok} success, ${fail} failed)`);
            await updateSyncJob(supabase, jobId, {
              progress: { step: `Fetching staff details: ${done}/${total}`, staff: staffPersonIds.size, season },
            });
          }
        },
      });
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

        const dobIso = normalizeDateOfBirthForDb(dateOfBirth);

        staffData.push({
          person_id: personId,
          name,
          role,
          email: email || null,
          phone: phone || null,
          date_of_birth: dobIso,
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
        
        // Staff cleanup is handled in the global cleanup phase below (soft-inactivate only).
        console.log('[Staff Cleanup] Deferred to global cleanup phase (soft inactivate).');
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

    let campersInactivated = 0;
    let staffInactivated = 0;

    try {
      const enrolledCmPersonIds = enrolledPersonIdArray.map(String);
      const staffCmPersonIds = Array.from(staffPersonIds);

      // Inactivate campers no longer enrolled in CampMinder (use enrolled list, not camperData)
      if ((syncType === 'full' || syncType === 'campers') && enrolledCmPersonIds.length > 0) {
        console.log(`[Cleanup] Checking for campers not in CampMinder enrolled list (${enrolledCmPersonIds.length} enrolled)...`);

        const { data: existingCampers, error: fetchError } = await supabase
          .from('children')
          .select('id, person_id, name')
          .eq('company_id', companyId)
          .eq('season', season)
          .neq('status', 'inactive');

        if (fetchError) {
          console.error('[Cleanup] Error fetching existing campers:', fetchError);
        } else if (existingCampers) {
          const camperPersonIdSet = new Set(enrolledCmPersonIds);
          const campersToInactivate = existingCampers.filter(
            (c: { id: string; person_id: string; name: string }) =>
              c.person_id && !camperPersonIdSet.has(String(c.person_id)),
          );

          if (campersToInactivate.length > 0) {
            console.log(`[Cleanup] Found ${campersToInactivate.length} campers to inactivate (not enrolled in CampMinder):`);
            campersToInactivate.slice(0, 10).forEach((c: { id: string; person_id: string; name: string }) => {
              console.log(`  - ${c.name} (person_id: ${c.person_id})`);
            });
            if (campersToInactivate.length > 10) {
              console.log(`  ... and ${campersToInactivate.length - 10} more`);
            }

            const BATCH_SIZE = 100;
            for (let i = 0; i < campersToInactivate.length; i += BATCH_SIZE) {
              const batchIds = campersToInactivate.slice(i, i + BATCH_SIZE).map((c: { id: string }) => c.id);
              const { error: updateError } = await supabase
                .from('children')
                .update({ status: 'inactive', updated_at: new Date().toISOString() })
                .in('id', batchIds);
              if (updateError) {
                throw updateError;
              }
            }

            campersInactivated = campersToInactivate.length;
            console.log(`[Cleanup] Successfully inactivated ${campersInactivated} campers`);
          } else {
            console.log('[Cleanup] No campers to inactivate - all match CampMinder enrolled list');
          }
        }
      } else if (syncType === 'full' || syncType === 'campers') {
        console.warn('[Cleanup] Skipping camper inactivation — no enrolled attendees from CampMinder');
      }

      // Staff status sync with CampMinder (source of truth for hired/active)
      if ((syncType === 'full' || syncType === 'staff') && staffCmPersonIds.length > 0) {
        const cmActiveCount = staffCmPersonIds.length;
        console.log(`[Staff Status] CampMinder active staff: ${cmActiveCount}`);

        // Always mark CampMinder active staff as active in our DB (upsert may skip status if unchanged)
        const REACTIVATE_BATCH = 100;
        for (let i = 0; i < staffCmPersonIds.length; i += REACTIVATE_BATCH) {
          const personIdBatch = staffCmPersonIds.slice(i, i + REACTIVATE_BATCH);
          const { error: reactivateError } = await supabase
            .from('staff')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('company_id', companyId)
            .eq('season', season)
            .in('person_id', personIdBatch);
          if (reactivateError) {
            console.error('[Staff Status] Error reactivating CampMinder staff batch:', reactivateError);
          }
        }

        const { count: dbActiveStaffCount, error: countError } = await supabase
          .from('staff')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('season', season)
          .neq('status', 'inactive');

        if (countError) {
          console.error('[Staff Status] Error counting active staff:', countError);
        }

        const dbActive = dbActiveStaffCount ?? 0;
        // Skip cleanup when CM response looks incomplete (prevents mass wrongful inactivation)
        const skipStaffInactivation =
          cmActiveCount < 100 ||
          (dbActive > 0 && cmActiveCount < Math.floor(dbActive * 0.85));

        if (skipStaffInactivation) {
          console.warn(
            `[Staff Status] SKIPPING inactivation — CampMinder returned ${cmActiveCount} active but DB has ${dbActive}. Possible incomplete API response.`,
          );
        } else {
          console.log(`[Cleanup] Aligning DB to CampMinder active list (${cmActiveCount} person IDs)...`);

          const { data: existingStaff, error: fetchError } = await supabase
            .from('staff')
            .select('id, person_id, name')
            .eq('company_id', companyId)
            .eq('season', season)
            .neq('status', 'inactive');

          if (fetchError) {
            console.error('[Cleanup] Error fetching existing staff:', fetchError);
          } else if (existingStaff) {
            const staffPersonIdSet = new Set(staffCmPersonIds.map(String));
            const staffToInactivate = existingStaff.filter(
              (s: { id: string; person_id: string | null; name: string }) =>
                !s.person_id || !staffPersonIdSet.has(String(s.person_id)),
            );

            if (staffToInactivate.length > 0) {
              console.log(`[Cleanup] Found ${staffToInactivate.length} staff to inactivate (not in CampMinder active list or missing person_id):`);
              staffToInactivate.slice(0, 10).forEach((s: { id: string; person_id: string | null; name: string }) => {
                console.log(`  - ${s.name} (person_id: ${s.person_id ?? 'none'})`);
              });
              if (staffToInactivate.length > 10) {
                console.log(`  ... and ${staffToInactivate.length - 10} more`);
              }

              const BATCH_SIZE = 100;
              for (let i = 0; i < staffToInactivate.length; i += BATCH_SIZE) {
                const batchIds = staffToInactivate.slice(i, i + BATCH_SIZE).map((s: { id: string }) => s.id);
                const { error: updateError } = await supabase
                  .from('staff')
                  .update({ status: 'inactive', updated_at: new Date().toISOString() })
                  .in('id', batchIds);
                if (updateError) {
                  throw updateError;
                }
              }

              staffInactivated = staffToInactivate.length;
              console.log(`[Cleanup] Successfully inactivated ${staffInactivated} staff`);
            } else {
              console.log('[Cleanup] No staff to inactivate — DB matches CampMinder active list');
            }
          }
        }
      } else if (syncType === 'full' || syncType === 'staff') {
        console.warn('[Cleanup] Skipping staff status sync — no active staff returned from CampMinder');
      }

      console.log(`[Cleanup Summary] Inactivated ${campersInactivated} campers, inactivated ${staffInactivated} staff`);
    } catch (error) {
      console.error('[Cleanup] Error during cleanup phase:', error);
    }

    // Financials run on their own cron window (8 AM / 8 PM Eastern) via sync_type=financials
    // so camper/staff jobs are not slowed down or timed out by transaction pagination.
    const financialDeposits = 0;
    const financialReversals = 0;
    const financialSkipped = 0;
    const financialUpdated = 0;

    if (owlPayConfig.enabled && (syncType === 'full' || syncType === 'campers' || syncType === 'staff')) {
      console.log(
        `[Financials] Skipped — runs separately at 8 AM / 8 PM Eastern (sync_type=financials) for company ${companyId}.`,
      );
    }

    // Last successful CampMinder sync (only reached if performFullSync completes without throwing)
    const { error: lastSyncErr } = await supabase
      .from('companies')
      .update({ campminder_last_sync_at: new Date().toISOString() })
      .eq('id', companyId);
    if (lastSyncErr) {
      console.error('[Companies] Failed to update campminder_last_sync_at:', lastSyncErr);
    }

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
      financial_updated: financialUpdated,
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


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
  const { company_id, season_id, incremental, sync_type } = await req.json().catch(() => ({}));
    
    // sync_type can be: 'campers', 'staff', 'financials', or 'full' (default).
    // Cron schedule (Eastern): campers 6/18, staff 7/19, financials 8/20.
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
    /** Run one camp after another so global CampMinder rate limiting doesn't interleave 3+ full-roster fetches. */
    const queuedSyncs: Array<{
      jobId: string;
      companyId: string;
      companyName: string;
      token: string;
      subscriptionKey: string;
      clientId: string;
      seasonId?: string;
      isIncremental: boolean;
      lastSyncAt?: string;
      syncType: string;
      staleClosed: number;
      owlPayConfig: OwlPayConfig;
    }> = [];

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

        const staleClosed = await failStaleCampminderSyncJobs(supabase, company.id, 120);

        const { data: inFlightJobs, error: inFlightErr } = await supabase
          .from('sync_jobs')
          .select('id, status, created_at, progress')
          .eq('company_id', company.id)
          .eq('entity_type', 'campminder')
          .in('status', ['running', 'pending'])
          .order('created_at', { ascending: false });

        if (inFlightErr) {
          console.error('Failed to check in-flight sync jobs:', inFlightErr);
        } else {
          const sameTypeInFlight = (inFlightJobs || []).filter((j: { progress?: { syncType?: string } }) => {
            const runningType = j.progress?.syncType;
            return runningType === effectiveSyncType || (!runningType && effectiveSyncType === 'full');
          });

          if (sameTypeInFlight.length > 0) {
            const blocked = sameTypeInFlight[0];
            console.warn(
              `[Sync] Skipping ${company.name} ${effectiveSyncType} — job ${blocked.id} already ${blocked.status}`,
            );
            results.push({
              company: company.name,
              company_id: company.id,
              status: 'skipped',
              message: `${effectiveSyncType} sync already ${blocked.status} (job ${blocked.id})`,
              stale_closed: staleClosed,
            });
            continue;
          }
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
            progress: {
              step: 'Initializing',
              syncType: effectiveSyncType,
              isIncremental,
            },
            total_counts: {},
          })
          .select()
          .single();

        if (jobError) {
          console.error('Failed to create sync job:', jobError);
          throw new Error('Failed to create sync job');
        }

        console.log(`Created sync job: ${job.id} (${isIncremental ? 'incremental' : 'full'})`);

        // Per-company Owl Pay configuration. Columns are added by migration
        // 20260502000000_companies_owl_pay_config.sql; coalesce to safe defaults
        // so an Edge function deploy that runs before the migration just acts
        // like Owl Pay is disabled rather than crashing.
        const owlPayConfig: OwlPayConfig = {
          enabled: company.owl_pay_enabled === true,
          categoryIds: Array.isArray(company.campminder_owl_pay_category_ids)
            ? company.campminder_owl_pay_category_ids.map((s: unknown) => String(s))
            : [],
          descriptionKeywords: Array.isArray(company.campminder_owl_pay_description_keywords)
            ? company.campminder_owl_pay_description_keywords.map((s: unknown) => String(s))
            : [],
        };

        queuedSyncs.push({
          jobId: job.id,
          companyId: company.id,
          companyName: company.name,
          token,
          subscriptionKey: subKeyData,
          clientId,
          seasonId: season_id,
          isIncremental,
          lastSyncAt,
          syncType: effectiveSyncType,
          staleClosed,
          owlPayConfig,
        });

        results.push({
          company: company.name,
          company_id: company.id,
          status: 'started',
          job_id: job.id,
          sync_type: effectiveSyncType,
          incremental_flag: isIncremental,
          stale_jobs_closed: staleClosed,
          owl_pay_enabled: owlPayConfig.enabled,
          message:
            `${effectiveSyncType} sync queued (${isIncremental ? 'incremental' : 'full'} mode). Companies run sequentially in background — check sync_jobs for progress.`,
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

    if (queuedSyncs.length > 0) {
      EdgeRuntime.waitUntil(
        (async () => {
          for (let i = 0; i < queuedSyncs.length; i++) {
            const q = queuedSyncs[i];
            console.log(
              `[CampMinder BG] (${i + 1}/${queuedSyncs.length}) Starting sync for ${q.companyName} job=${q.jobId}`,
            );
            try {
              await performFullSync(
                supabase,
                q.jobId,
                q.companyId,
                q.token,
                q.subscriptionKey,
                q.clientId,
                q.seasonId,
                q.isIncremental,
                q.lastSyncAt,
                q.syncType,
                q.owlPayConfig,
              );
            } catch (bgErr) {
              console.error(`[CampMinder BG] performFullSync failed for ${q.companyName}:`, bgErr);
            }
          }
          console.log(`[CampMinder BG] Finished ${queuedSyncs.length} sequential company sync(s).`);
        })(),
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync jobs started in background (companies run one after another)',
        results,
        note:
          'Companies run sequentially in background. Scheduled sync: 6 AM & 6 PM Eastern (campers), then 7 AM & 7 PM (staff). Manual full sync may timeout on large camps — use Campers Only then Staff Only.',
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
