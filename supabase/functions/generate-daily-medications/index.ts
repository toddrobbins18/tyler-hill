import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  campProgramEndDate,
  easternSeasonYear,
  easternTodayYMD,
  medicationAppliesOnDate,
  medicationSlotKey,
  type MedicationLogRow,
} from "../_shared/medicationAlertUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = easternTodayYMD();
    const season = easternSeasonYear();
    const dayOfWeek = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    ).toLocaleDateString("en-US", { weekday: "long" });

    console.log(`Generating medications for ${today} (${dayOfWeek}, season ${season})`);

    const { data: recurringMeds, error: fetchError } = await supabase
      .from("medication_logs")
      .select("*")
      .eq("is_recurring", true)
      .eq("season", season)
      .lte("date", today)
      .or(`end_date.is.null,end_date.gte.${today}`);

    if (fetchError) {
      console.error("Error fetching recurring medications:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${recurringMeds?.length || 0} recurring medication templates`);

    const { data: existingToday } = await supabase
      .from("medication_logs")
      .select("id, child_id, medication_name, meal_time, company_id")
      .eq("date", today)
      .eq("season", season);

    const existingKeys = new Set(
      (existingToday || []).map((row) =>
        `${row.company_id}|${medicationSlotKey(row as MedicationLogRow)}`
      ),
    );

    const medicationsToCreate: Record<string, unknown>[] = [];

    for (const med of recurringMeds || []) {
      if (!medicationAppliesOnDate(med as MedicationLogRow, today, season)) continue;
      if (med.date === today) continue;

      const slotKey = `${med.company_id}|${medicationSlotKey(med as MedicationLogRow)}`;
      if (existingKeys.has(slotKey)) continue;

      medicationsToCreate.push({
        child_id: med.child_id,
        medication_name: med.medication_name,
        dosage: med.dosage,
        meal_time: med.meal_time,
        scheduled_time: med.scheduled_time,
        notes: med.notes,
        date: today,
        company_id: med.company_id,
        season,
        administered: false,
        refused: false,
        alert_sent: false,
        is_recurring: false,
        frequency: med.frequency,
        days_of_week: med.days_of_week,
        end_date: med.end_date || campProgramEndDate(season),
      });
      existingKeys.add(slotKey);
    }

    if (medicationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("medication_logs")
        .insert(medicationsToCreate);

      if (insertError) {
        console.error("Error inserting medications:", insertError);
        throw insertError;
      }

      console.log(`Created ${medicationsToCreate.length} medication entries for ${today}`);
    } else {
      console.log(`No new medication entries needed for ${today}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: medicationsToCreate.length,
        date: today,
        season,
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
