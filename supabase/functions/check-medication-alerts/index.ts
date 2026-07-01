import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getRecipientsForEmailTypeWithFilters, sendEmailNotifications } from "../_shared/emailHelpers.ts";
import {
  easternSeasonYear,
  easternTodayYMD,
  findDaySpecificMedicationLog,
  formatScheduledTimeForAlert,
  isAsNeededMedication,
  mergeMedicationsForDate,
  medicationAlertIsDue,
  medicationAlreadyAlerted,
  type MedicationLogRow,
} from "../_shared/medicationAlertUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MED_SELECT = `
  id,
  medication_name,
  dosage,
  scheduled_time,
  meal_time,
  date,
  company_id,
  season,
  child_id,
  is_recurring,
  frequency,
  days_of_week,
  end_date,
  administered,
  refused,
  alert_sent,
  child:children (
    id,
    name,
    division_id,
    division:divisions ( id, name )
  )
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const today = easternTodayYMD();
    const season = easternSeasonYear();
    const now = new Date();
    console.log(`Checking for missed medications on ${today} (${season})`);

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true);

    if (companiesError) throw companiesError;

    let alertsSent = 0;

    for (const company of companies || []) {
      const [dateResult, recurringResult] = await Promise.all([
        supabase
          .from("medication_logs")
          .select(MED_SELECT)
          .eq("date", today)
          .eq("company_id", company.id)
          .eq("season", season),
        supabase
          .from("medication_logs")
          .select(MED_SELECT)
          .eq("is_recurring", true)
          .eq("company_id", company.id)
          .eq("season", season)
          .lte("date", today)
          .or(`end_date.is.null,end_date.gte.${today}`),
      ]);

      if (dateResult.error) throw dateResult.error;
      if (recurringResult.error) throw recurringResult.error;

      const dateRows = (dateResult.data || []) as MedicationLogRow[];
      const recurringRows = (recurringResult.data || []) as MedicationLogRow[];

      const merged = mergeMedicationsForDate(dateRows, recurringRows, today, season);

      const pending = merged.filter(
        (med) => !med.administered && !med.refused && !isAsNeededMedication(med) && !medicationAlreadyAlerted(med, dateRows),
      );

      const dueMeds = pending.filter((med) => medicationAlertIsDue(now, med.scheduled_time));

      if (!dueMeds.length) {
        continue;
      }

      console.log(`Company ${company.name}: ${dueMeds.length} missed medication(s) due for alert`);

      const medsByChild = dueMeds.reduce((acc: Record<string, { child: any; medications: MedicationLogRow[] }>, med) => {
        const childId = (med as any).child?.id;
        if (!childId) return acc;
        if (!acc[childId]) {
          acc[childId] = { child: (med as any).child, medications: [] };
        }
        acc[childId].medications.push(med);
        return acc;
      }, {});

      for (const { child, medications } of Object.values(medsByChild)) {
        const divisionId = child.division_id || child.division?.id;
        const recipients = await getRecipientsForEmailTypeWithFilters(
          supabase,
          "missed_medication",
          company.id,
          divisionId ? { divisionIds: [divisionId] } : undefined,
        );

        if (!recipients.length) {
          console.log(
            `No recipients for missed medication alert (${child.name}, division ${divisionId || "unknown"}) in ${company.name}`,
          );
          continue;
        }

        const subject = `Missed Medication Alert: ${child.name}`;
        const content = `
<p><strong>Child:</strong> ${child.name}<br/>
<strong>Division:</strong> ${child.division?.name || "N/A"}<br/>
<strong>Date:</strong> ${today}</p>
<p><strong>Missed Medications:</strong></p>
<ul>${medications.map((m) => `<li>${m.medication_name} (${m.dosage || "N/A"}) at ${formatScheduledTimeForAlert(m.scheduled_time)}</li>`).join("")}</ul>
<p>Please ensure these medications are administered as soon as possible.</p>
        `.trim();

        await sendEmailNotifications(supabase, recipients, subject, content, company.id);

        for (const med of medications) {
          const dayLog = findDaySpecificMedicationLog(dateRows, med);

          if (dayLog) {
            await supabase
              .from("medication_logs")
              .update({ alert_sent: true })
              .eq("id", dayLog.id);
          } else {
            await supabase.from("medication_logs").insert({
              child_id: med.child_id,
              date: today,
              medication_name: med.medication_name,
              dosage: med.dosage,
              meal_time: med.meal_time,
              scheduled_time: med.scheduled_time,
              notes: med.notes,
              is_recurring: false,
              frequency: med.frequency,
              days_of_week: med.days_of_week,
              end_date: med.end_date,
              company_id: company.id,
              season,
              administered: false,
              refused: false,
              alert_sent: true,
            });
          }
        }

        alertsSent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, alerts_sent: alertsSent, date: today }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("Error in check-medication-alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
