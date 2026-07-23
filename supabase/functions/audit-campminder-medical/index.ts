import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CM_AUTH_URL = "https://api.campminder.com/auth/apikey";
const CM_PERSONS_URL = "https://api.campminder.com/persons";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getJwtToken(subscriptionKey: string, apiKey: string) {
  const response = await fetch(CM_AUTH_URL, {
    method: "GET",
    headers: {
      Authorization: apiKey,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });
  const data = await response.json();
  if (!response.ok || !data.Token) {
    throw new Error(data.Message || data.error || "CampMinder auth failed");
  }
  return { token: data.Token as string, clientId: (data.ClientIDs?.[0] as string) || "" };
}

async function fetchPerson(
  personId: string,
  clientId: string,
  token: string,
  subscriptionKey: string,
  includeMedical: boolean,
) {
  const medicalFlag = includeMedical ? "&includemedicalinfo=true" : "";
  const url =
    `${CM_PERSONS_URL}/${personId}?clientid=${clientId}` +
    `&includecamperdetails=true&includecontactdetails=true&includerelatives=true&includestaffdetails=true` +
    medicalFlag;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    topLevelKeys: json && typeof json === "object" ? Object.keys(json) : [],
    hasMedicalInfo: !!json?.MedicalInfo,
    medicalInfoKeys: json?.MedicalInfo && typeof json.MedicalInfo === "object"
      ? Object.keys(json.MedicalInfo)
      : [],
    allergies: json?.MedicalInfo?.Allergies ?? null,
    medicalNotes: json?.MedicalInfo?.Notes ?? null,
    name: json?.Name
      ? `${json.Name.First || ""} ${json.Name.Last || ""}`.trim()
      : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, person_ids, sample_size = 5 } = await req.json().catch(() => ({}));

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name, campminder_api_key_encrypted, campminder_subscription_key_encrypted")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    const { data: apiKey } = await supabase.rpc("decrypt_secret", {
      encrypted: company.campminder_api_key_encrypted,
    });
    const { data: subKey } = await supabase.rpc("decrypt_secret", {
      encrypted: company.campminder_subscription_key_encrypted,
    });

    if (!apiKey || !subKey) {
      throw new Error("CampMinder credentials not configured");
    }

    let ids: string[] = Array.isArray(person_ids) ? person_ids.map(String) : [];

    if (ids.length === 0) {
      const { data: sampleChildren } = await supabase
        .from("children")
        .select("person_id, name, allergies, medical_notes")
        .eq("company_id", company_id)
        .eq("season", "2026")
        .eq("status", "active")
        .not("person_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(sample_size);

      ids = (sampleChildren || []).map((c) => String(c.person_id));
    }

    const { token, clientId } = await getJwtToken(subKey, apiKey);

    const results = [];
    for (const personId of ids) {
      const withoutMedical = await fetchPerson(personId, clientId, token, subKey, false);
      const withMedical = await fetchPerson(personId, clientId, token, subKey, true);

      const { data: nestChild } = await supabase
        .from("children")
        .select("name, allergies, medical_notes, updated_at")
        .eq("company_id", company_id)
        .eq("person_id", personId)
        .eq("season", "2026")
        .maybeSingle();

      results.push({
        person_id: personId,
        nest: nestChild,
        campminder_without_medical_flag: withoutMedical,
        campminder_with_medical_flag: withMedical,
      });
    }

    const summary = {
      company: company.name,
      sampled: results.length,
      nest_blank_allergies: results.filter((r) => !r.nest?.allergies?.trim?.()).length,
      cm_returns_medical_without_flag: results.filter((r) => r.campminder_without_medical_flag.hasMedicalInfo).length,
      cm_returns_medical_with_flag: results.filter((r) => r.campminder_with_medical_flag.hasMedicalInfo).length,
      cm_returns_allergies_with_flag: results.filter((r) => {
        const v = r.campminder_with_medical_flag.allergies;
        return typeof v === "string" && v.trim().length > 0;
      }).length,
    };

    return new Response(JSON.stringify({ summary, results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
