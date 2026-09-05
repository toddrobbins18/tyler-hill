import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { probeCampminderBunks } from "../_shared/campminderBunks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CM_AUTH_URL = "https://api.campminder.com/auth/apikey";
const NORTH_SHORE_COMPANY_ID = "0d98861f-d956-4bfb-b273-851b3ae56d5c";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const company_id = body.company_id ?? NORTH_SHORE_COMPANY_ID;
    const person_id = body.person_id ? String(body.person_id) : undefined;
    const season = String(body.season ?? "2027");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("campminder_api_key_encrypted, campminder_subscription_key_encrypted")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    const { data: apiKey } = await supabase.rpc("decrypt_secret", {
      encrypted: company.campminder_api_key_encrypted,
    });
    const { data: subscriptionKey } = await supabase.rpc("decrypt_secret", {
      encrypted: company.campminder_subscription_key_encrypted,
    });

    const authResponse = await fetch(CM_AUTH_URL, {
      method: "GET",
      headers: {
        Authorization: apiKey,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    });

    const authData = await authResponse.json();
    if (!authResponse.ok || !authData.Token) {
      throw new Error(authData.Message || "CampMinder auth failed");
    }

    const clientIds = authData.ClientIDs
      ? String(authData.ClientIDs).split(",").map((id: string) => id.trim())
      : [];
    const clientId = clientIds[0];
    if (!clientId) throw new Error("No CampMinder client ID");

    const probe = await probeCampminderBunks(
      authData.Token,
      subscriptionKey,
      clientId,
      season,
      person_id,
    );

    return new Response(
      JSON.stringify({
        success: true,
        company_id,
        season,
        person_id: person_id ?? null,
        probe,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
