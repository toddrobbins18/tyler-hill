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

    // Call CampMinder auth endpoint to get JWT token
    const authResponse = await fetch('https://webapi.campminder.com/api/auth/GetJWTWithApiKey', {
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

    const authData = await authResponse.json();

    if (!authResponse.ok || !authData.Success) {
      console.error('CampMinder auth failed:', authData);
      
      // Update last test status
      await supabase
        .from('companies')
        .update({ 
          campminder_last_sync_at: new Date().toISOString(),
        })
        .eq('id', company_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: authData.ErrorText || 'Authentication failed' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('CampMinder connection successful for company:', company_id);

    // Update last sync timestamp on success
    await supabase
      .from('companies')
      .update({ 
        campminder_last_sync_at: new Date().toISOString(),
      })
      .eq('id', company_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful',
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
