import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key for decryption
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company CampMinder config
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('campminder_api_key_encrypted, campminder_subscription_key_encrypted')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      console.error('Error fetching company:', companyError);
      return new Response(
        JSON.stringify({ success: false, error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!company.campminder_api_key_encrypted || !company.campminder_subscription_key_encrypted) {
      return new Response(
        JSON.stringify({ success: false, error: 'CampMinder credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decrypt credentials using database function
    const { data: apiKeyResult, error: apiKeyError } = await supabase
      .rpc('decrypt_secret', { encrypted: company.campminder_api_key_encrypted });

    const { data: subscriptionKeyResult, error: subscriptionKeyError } = await supabase
      .rpc('decrypt_secret', { encrypted: company.campminder_subscription_key_encrypted });

    if (apiKeyError || subscriptionKeyError) {
      console.error('Error decrypting credentials:', apiKeyError || subscriptionKeyError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to decrypt credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = apiKeyResult;
    const subscriptionKey = subscriptionKeyResult;

    console.log('Testing CampMinder connection for company:', company_id);
    console.log('API Key length:', apiKey?.length || 0);
    console.log('Subscription Key length:', subscriptionKey?.length || 0);

    // Call CampMinder auth endpoint using correct format from documentation
    // GET https://api.campminder.com/auth/apikey
    // Headers: Authorization: {apiKey} (no Bearer prefix), Ocp-Apim-Subscription-Key: {subscriptionKey}
    const authResponse = await fetch('https://api.campminder.com/auth/apikey', {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
    });

    console.log('CampMinder auth response status:', authResponse.status);
    console.log('CampMinder auth response headers:', Object.fromEntries(authResponse.headers.entries()));

    // Check if response is JSON before parsing
    const contentType = authResponse.headers.get('content-type');
    const responseText = await authResponse.text();
    
    console.log('CampMinder auth response content-type:', contentType);
    console.log('CampMinder auth response body (first 500 chars):', responseText.substring(0, 500));

    if (!contentType?.includes('application/json')) {
      console.error('CampMinder returned non-JSON response:', responseText.substring(0, 1000));

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `CampMinder returned unexpected response (status ${authResponse.status}). The API may be down or the endpoint URL may have changed.`,
          details: responseText.substring(0, 200)
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authData;
    try {
      authData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse CampMinder response as JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to parse CampMinder response',
          details: responseText.substring(0, 200)
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for successful response - expecting Token and ClientIDs
    if (!authResponse.ok || !authData.Token) {
      console.error('CampMinder auth failed:', authData);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: authData.Message || authData.error || 'Authentication failed - check your API Key and Subscription Key'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('CampMinder connection successful for company:', company_id);
    console.log('ClientIDs:', authData.ClientIDs);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful',
        clientIds: authData.ClientIDs,
        token_expires_in: '1 hour'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error testing CampMinder connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
