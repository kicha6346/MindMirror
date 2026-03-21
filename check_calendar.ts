import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCalendarData() {
  console.log('--- FETCHING CALENDAR ACTIVITY DATA ---');
  
  const { data, error } = await supabase
    .from('calendar_activity')
    .select('*')
    .order('date', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error("❌ Error fetching calendar data:", error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No calendar records found. Wait for the user to authenticate with Google and sync!");
    return;
  }
  
  console.log(`✅ Successfully found ${data.length} recent calendar records:`);
  console.table(data);
}

checkCalendarData();
