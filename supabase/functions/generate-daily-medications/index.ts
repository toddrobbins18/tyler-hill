import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    console.log(`Generating medications for ${today} (${dayOfWeek})`);

    // Find all recurring medications that should generate an entry for today
    const { data: recurringMeds, error: fetchError } = await supabase
      .from('medication_logs')
      .select('*')
      .eq('is_recurring', true)
      .or(`end_date.is.null,end_date.gte.${today}`);

    if (fetchError) {
      console.error('Error fetching recurring medications:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${recurringMeds?.length || 0} recurring medications`);

    const medicationsToCreate = [];

    for (const med of recurringMeds || []) {
      let shouldCreate = false;

      // Check if we should create an entry based on frequency
      if (med.frequency === 'daily') {
        shouldCreate = true;
      } else if (med.frequency === 'weekly') {
        shouldCreate = true; // Create weekly (you might want to add more logic here)
      } else if (med.frequency === 'custom' && med.days_of_week) {
        shouldCreate = med.days_of_week.includes(dayOfWeek);
      }

      if (shouldCreate) {
        // Check if an entry already exists for today
        const { data: existing } = await supabase
          .from('medication_logs')
          .select('id')
          .eq('child_id', med.child_id)
          .eq('medication_name', med.medication_name)
          .eq('meal_time', med.meal_time)
          .eq('date', today)
          .maybeSingle();

        if (!existing) {
          medicationsToCreate.push({
            child_id: med.child_id,
            medication_name: med.medication_name,
            dosage: med.dosage,
            meal_time: med.meal_time,
            notes: med.notes,
            date: today,
            administered: false,
            is_recurring: false, // Daily entries are not marked as recurring
          });
        }
      }
    }

    if (medicationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('medication_logs')
        .insert(medicationsToCreate);

      if (insertError) {
        console.error('Error inserting medications:', insertError);
        throw insertError;
      }

      console.log(`Created ${medicationsToCreate.length} medication entries for today`);
    } else {
      console.log('No new medication entries needed for today');
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: medicationsToCreate.length,
        date: today,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-daily-medications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
