import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const body = await req.json().catch(() => ({}));
    const { company_id, company_slug, season = '2026', cleanup_type = 'staff' } = body;

    console.log(`[Cleanup] Starting ${cleanup_type} cleanup for company: ${company_id || company_slug}, season: ${season}`);

    // Find company
    let companyQuery = supabase.from('companies').select('*').eq('campminder_sync_enabled', true);
    if (company_id) {
      companyQuery = companyQuery.eq('id', company_id);
    } else if (company_slug) {
      companyQuery = companyQuery.eq('slug', company_slug);
    }

    const { data: companies, error: companyError } = await companyQuery;

    if (companyError || !companies?.length) {
      return new Response(JSON.stringify({ 
        error: 'Company not found or CampMinder not enabled',
        details: companyError?.message 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any[] = [];

    for (const company of companies) {
      console.log(`[Cleanup] Processing company: ${company.name} (${company.id})`);

      if (cleanup_type === 'staff' || cleanup_type === 'all') {
        // Get CampMinder credentials
        const apiKeyEncrypted = company.campminder_api_key_encrypted;
        const subscriptionKeyEncrypted = company.campminder_subscription_key_encrypted;

        if (!apiKeyEncrypted || !subscriptionKeyEncrypted) {
          console.log(`[Cleanup] Skipping ${company.name} - missing CampMinder credentials`);
          results.push({ company: company.name, status: 'skipped', reason: 'Missing credentials' });
          continue;
        }

        // Decrypt credentials
        const { data: decryptedApiKey } = await supabase.rpc('decrypt_secret', { encrypted: apiKeyEncrypted });
        const { data: decryptedSubKey } = await supabase.rpc('decrypt_secret', { encrypted: subscriptionKeyEncrypted });

        if (!decryptedApiKey || !decryptedSubKey) {
          console.log(`[Cleanup] Skipping ${company.name} - failed to decrypt credentials`);
          results.push({ company: company.name, status: 'skipped', reason: 'Decryption failed' });
          continue;
        }

        // Get auth token - matches sync-campminder auth format exactly
        const authResponse = await fetch('https://api.campminder.com/auth/apikey', {
          method: 'GET',
          headers: {
            'Authorization': decryptedApiKey,
            'Ocp-Apim-Subscription-Key': decryptedSubKey,
          },
        });

        if (!authResponse.ok) {
          const errorText = await authResponse.text();
          console.error(`[Cleanup] Auth failed for ${company.name}:`, errorText);
          results.push({ company: company.name, status: 'error', reason: 'Auth failed', details: errorText.substring(0, 100) });
          continue;
        }

        const authData = await authResponse.json();
        // CampMinder returns Token (not AccessToken)
        const token = authData.Token;
        const clientId = authData.ClientIDs ? String(authData.ClientIDs).split(',')[0].trim() : '';

        if (!token) {
          console.error(`[Cleanup] No token in auth response for ${company.name}:`, JSON.stringify(authData).substring(0, 200));
          results.push({ company: company.name, status: 'error', reason: 'No token in response' });
          continue;
        }

        // Fetch active staff from CampMinder
        console.log(`[Cleanup] Fetching active staff from CampMinder for ${company.name}, season ${season}, clientId ${clientId}...`);
        
        // Must include seasonid parameter - CampMinder requires it for staff endpoint
        const staffUrl = `https://api.campminder.com/staff?clientid=${clientId}&seasonid=${season}&status=1&pagenumber=1&pagesize=500`;
        console.log(`[Cleanup] Staff URL: ${staffUrl}`);
        
        const staffResponse = await fetch(staffUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': decryptedSubKey,
          },
        });

        if (!staffResponse.ok) {
          const errorText = await staffResponse.text();
          console.error(`[Cleanup] Failed to fetch staff for ${company.name}: ${staffResponse.status} - ${errorText}`);
          results.push({ company: company.name, status: 'error', reason: 'Staff fetch failed', details: errorText.substring(0, 200) });
          continue;
        }

        const staffData = await staffResponse.json();
        const activeStaffList = staffData?.Results || staffData?.data || staffData || [];
        
        // Extract person IDs from active staff
        const activePersonIds = new Set<string>();
        for (const staff of activeStaffList) {
          const personId = String(staff.PersonID || staff.ID || staff.Person?.ID || '');
          if (personId) {
            activePersonIds.add(personId);
          }
        }

        console.log(`[Cleanup] Found ${activePersonIds.size} active staff in CampMinder`);

        // Get existing staff from database
        const { data: existingStaff, error: fetchError } = await supabase
          .from('staff')
          .select('id, person_id, name')
          .eq('company_id', company.id)
          .eq('season', season);

        if (fetchError) {
          console.error(`[Cleanup] Error fetching existing staff:`, fetchError);
          results.push({ company: company.name, status: 'error', reason: 'DB fetch failed' });
          continue;
        }

        // Find staff to remove (not in active list)
        const staffToRemove = (existingStaff || []).filter((s: any) => !activePersonIds.has(s.person_id));
        
        console.log(`[Cleanup] Found ${staffToRemove.length} staff to remove (${existingStaff?.length || 0} total in DB)`);

        if (staffToRemove.length > 0) {
          // Log first 10 for debugging
          staffToRemove.slice(0, 10).forEach((s: any) => {
            console.log(`  - Removing: ${s.name} (person_id: ${s.person_id})`);
          });

          const idsToRemove = staffToRemove.map((s: any) => s.id);
          const { error: deleteError } = await supabase
            .from('staff')
            .delete()
            .in('id', idsToRemove);

          if (deleteError) {
            console.error(`[Cleanup] Error removing staff:`, deleteError);
            results.push({ 
              company: company.name, 
              status: 'error', 
              reason: 'Delete failed',
              details: deleteError.message 
            });
          } else {
            console.log(`[Cleanup] Successfully removed ${staffToRemove.length} inactive staff`);
            results.push({ 
              company: company.name, 
              status: 'success',
              removed: staffToRemove.length,
              remaining: (existingStaff?.length || 0) - staffToRemove.length,
              active_in_campminder: activePersonIds.size
            });
          }
        } else {
          results.push({ 
            company: company.name, 
            status: 'success',
            removed: 0,
            remaining: existingStaff?.length || 0,
            active_in_campminder: activePersonIds.size,
            message: 'No inactive staff to remove'
          });
        }
      }

      // =====================================================
      // CAMPER CLEANUP: Mark dropped campers as inactive
      // =====================================================
      if (cleanup_type === 'campers' || cleanup_type === 'all') {
        console.log(`[Cleanup] Starting camper cleanup for ${company.name}...`);

        // Get CampMinder credentials (reuse from staff if already fetched)
        const camperApiKeyEncrypted = company.campminder_api_key_encrypted;
        const camperSubKeyEncrypted = company.campminder_subscription_key_encrypted;

        if (!camperApiKeyEncrypted || !camperSubKeyEncrypted) {
          console.log(`[Cleanup] Skipping camper cleanup for ${company.name} - missing credentials`);
          results.push({ company: company.name, type: 'campers', status: 'skipped', reason: 'Missing credentials' });
        } else {
          const { data: decApiKey } = await supabase.rpc('decrypt_secret', { encrypted: camperApiKeyEncrypted });
          const { data: decSubKey } = await supabase.rpc('decrypt_secret', { encrypted: camperSubKeyEncrypted });

          if (!decApiKey || !decSubKey) {
            results.push({ company: company.name, type: 'campers', status: 'skipped', reason: 'Decryption failed' });
          } else {
            // Auth
            const camperAuthResponse = await fetch('https://api.campminder.com/auth/apikey', {
              method: 'GET',
              headers: {
                'Authorization': decApiKey,
                'Ocp-Apim-Subscription-Key': decSubKey,
              },
            });

            if (!camperAuthResponse.ok) {
              results.push({ company: company.name, type: 'campers', status: 'error', reason: 'Auth failed' });
            } else {
              const camperAuthData = await camperAuthResponse.json();
              const camperToken = camperAuthData.Token;
              const camperClientId = camperAuthData.ClientIDs ? String(camperAuthData.ClientIDs).split(',')[0].trim() : '';

              if (!camperToken) {
                results.push({ company: company.name, type: 'campers', status: 'error', reason: 'No token' });
              } else {
                // Fetch enrolled attendees from CampMinder
                console.log(`[Cleanup] Fetching enrolled attendees for ${company.name}, season ${season}...`);
                const attendeesUrl = `https://api.campminder.com/sessions/attendees?clientid=${camperClientId}&seasonid=${season}&status=2&pagenumber=1&pagesize=500`;
                
                const attendeesResponse = await fetch(attendeesUrl, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${camperToken}`,
                    'Ocp-Apim-Subscription-Key': decSubKey,
                  },
                });

                if (!attendeesResponse.ok) {
                  const errorText = await attendeesResponse.text();
                  console.error(`[Cleanup] Failed to fetch attendees: ${attendeesResponse.status} - ${errorText}`);
                  results.push({ company: company.name, type: 'campers', status: 'error', reason: 'Attendee fetch failed' });
                } else {
                  const attendeesData = await attendeesResponse.json();
                  const enrolledList = attendeesData?.Results || attendeesData?.data || attendeesData || [];

                  const enrolledPersonIds = new Set<string>();
                  for (const attendee of enrolledList) {
                    const personId = String(attendee.PersonID || attendee.ID || '');
                    if (personId) enrolledPersonIds.add(personId);
                  }

                  console.log(`[Cleanup] Found ${enrolledPersonIds.size} enrolled campers in CampMinder`);

                  // Get existing active campers from database
                  const { data: existingCampers, error: camperFetchError } = await supabase
                    .from('children')
                    .select('id, person_id, name, status')
                    .eq('company_id', company.id)
                    .eq('season', season)
                    .neq('status', 'inactive');

                  if (camperFetchError) {
                    console.error(`[Cleanup] Error fetching existing campers:`, camperFetchError);
                    results.push({ company: company.name, type: 'campers', status: 'error', reason: 'DB fetch failed' });
                  } else {
                    const campersToDeactivate = (existingCampers || []).filter(
                      (c: any) => c.person_id && !enrolledPersonIds.has(c.person_id)
                    );

                    console.log(`[Cleanup] Found ${campersToDeactivate.length} campers to mark inactive (${existingCampers?.length || 0} total in DB)`);

                    if (campersToDeactivate.length > 0) {
                      campersToDeactivate.slice(0, 10).forEach((c: any) => {
                        console.log(`  - Marking inactive: ${c.name} (person_id: ${c.person_id})`);
                      });

                      const idsToDeactivate = campersToDeactivate.map((c: any) => c.id);
                      const { error: updateError } = await supabase
                        .from('children')
                        .update({ status: 'inactive', updated_at: new Date().toISOString() })
                        .in('id', idsToDeactivate);

                      if (updateError) {
                        console.error(`[Cleanup] Error marking campers inactive:`, updateError);
                        results.push({ company: company.name, type: 'campers', status: 'error', reason: 'Update failed' });
                      } else {
                        console.log(`[Cleanup] Successfully marked ${campersToDeactivate.length} dropped campers as inactive`);
                        results.push({
                          company: company.name,
                          type: 'campers',
                          status: 'success',
                          deactivated: campersToDeactivate.length,
                          remaining_active: (existingCampers?.length || 0) - campersToDeactivate.length,
                          enrolled_in_campminder: enrolledPersonIds.size,
                        });
                      }
                    } else {
                      results.push({
                        company: company.name,
                        type: 'campers',
                        status: 'success',
                        deactivated: 0,
                        remaining_active: existingCampers?.length || 0,
                        enrolled_in_campminder: enrolledPersonIds.size,
                        message: 'No dropped campers to deactivate',
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      cleanup_type,
      season,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[Cleanup] Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Cleanup failed',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
