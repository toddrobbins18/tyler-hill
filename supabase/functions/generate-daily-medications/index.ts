import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { easternSeasonYear, easternTodayYMD } from "../_shared/medicationAlertUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Daily medication rows are expanded client-side (Nurse + mobile Health) via
 * mergeMedicationsForDate. Materializing copies here caused edits to appear to
 * revert because day-specific rows shadowed recurring templates.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = easternTodayYMD();
    const season = easternSeasonYear();

    console.log(
      `generate-daily-medications skipped for ${today} (${season}) — client-side merge handles schedules`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        created: 0,
        date: today,
        season,
        reason: "client-side merge handles daily medication schedules",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in generate-daily-medications:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
