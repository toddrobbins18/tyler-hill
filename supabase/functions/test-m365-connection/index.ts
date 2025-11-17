import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestConnectionRequest {
  company_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id }: TestConnectionRequest = await req.json();

    if (!company_id) {
      throw new Error("company_id is required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Fetch company's M365 configuration
    const { data: emailConfig, error: configError } = await supabase
      .from("company_email_config")
      .select("*")
      .eq("company_id", company_id)
      .single();

    if (configError || !emailConfig) {
      throw new Error("Email configuration not found");
    }

    if (!emailConfig.is_configured) {
      throw new Error("Email not configured");
    }

    // Decrypt the client secret
    const { data: decryptedSecret, error: decryptError } = await supabase.rpc(
      "decrypt_secret",
      { encrypted: emailConfig.m365_client_secret_encrypted }
    );

    if (decryptError) {
      console.error("Decryption error:", decryptError);
      throw new Error("Failed to decrypt credentials");
    }

    console.log("Testing M365 connection for company:", company_id);

    // Attempt to get access token from Microsoft
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${emailConfig.m365_tenant_id}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: emailConfig.m365_client_id,
          client_secret: decryptedSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token request failed:", tokenData);
      
      // Update test status
      await supabase
        .from("company_email_config")
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: "failed",
        })
        .eq("id", emailConfig.id);

      return new Response(
        JSON.stringify({
          success: false,
          message: tokenData.error_description || "Failed to authenticate with Microsoft 365",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("✓ Successfully obtained access token");

    // Update test status
    await supabase
      .from("company_email_config")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: "success",
      })
      .eq("id", emailConfig.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Connection successful",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in test-m365-connection function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        message: error.message 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
