import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, role, staff_type, division_id')
    .or('name.ilike.%naoko%,name.ilike.%tiago%');
  console.log(data);
}
check();
