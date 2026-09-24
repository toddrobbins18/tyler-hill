import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CAMP_TZ = "America/New_York";
const AUTO_SIGNOUT_HOUR = 16;
const AUTO_SIGNOUT_MINUTE = 15;

function easternParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function easternYmd(now = new Date()): string {
  const p = easternParts(now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function easternSeasonYear(now = new Date()): string {
  return String(easternParts(now).year);
}

/** ISO timestamp for today 4:15 PM Eastern (approximate via offset from noon UTC anchor). */
function autoSignOutTimestamp(workDateYmd: string): string {
  const [y, m, d] = workDateYmd.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const campHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CAMP_TZ,
      hour: "numeric",
      hour12: false,
    }).format(noonUtc),
  );
  const offsetHours = 12 - campHour;
  const utcHour = AUTO_SIGNOUT_HOUR + offsetHours;
  return new Date(Date.UTC(y, m - 1, d, utcHour, AUTO_SIGNOUT_MINUTE, 0)).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const parts = easternParts(now);

    // Hourly cron gate: only run at 4:15 PM Eastern (±5 min window handled by hourly tick at :15)
    if (parts.hour !== AUTO_SIGNOUT_HOUR || parts.minute < AUTO_SIGNOUT_MINUTE || parts.minute > AUTO_SIGNOUT_MINUTE + 5) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Not 4:15 PM Eastern window", eastern: parts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const workDate = easternYmd(now);
    const season = easternSeasonYear(now);
    const signedOutAt = autoSignOutTimestamp(workDate);

    const { data: openRows, error: loadError } = await supabase
      .from("staff_time_clock")
      .select("id, staff_id, company_id")
      .eq("work_date", workDate)
      .eq("season", season)
      .not("signed_in_at", "is", null)
      .is("signed_out_at", null);

    if (loadError) throw loadError;

    if (!openRows?.length) {
      return new Response(
        JSON.stringify({ success: true, autoSignedOut: 0, workDate }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = openRows.map((r) => r.id);
    const { error: updateError } = await supabase
      .from("staff_time_clock")
      .update({
        signed_out_at: signedOutAt,
        sign_out_method: "auto",
        auto_signed_out: true,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        autoSignedOut: ids.length,
        workDate,
        season,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("staff-time-clock-auto-signout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
