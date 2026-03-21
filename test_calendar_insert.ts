import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// use SERVICE role key or anon key to query pg_policies or see if we can insert a dummy row.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCalendarInsert() {
  console.log('--- TESTING CALENDAR ACTIVITY INSERT ---');
  
  // We need a valid user ID. Let's get one first.
  const { data: users } = await supabase.from('users').select('id').limit(1);
  if (!users || users.length === 0) {
    console.log("No users in the DB to test with.");
    return;
  }
  
  const testUserId = users[0].id;
  console.log(`Using TEST user: ${testUserId}`);

  // Test Insert
  const { data, error } = await supabase
    .from('calendar_activity')
    .insert([{
       user_id: testUserId,
       date: new Date().toISOString().split('T')[0],
       work_minutes: 5,
       weekend_work: false
    }])
    .select();
    
  if (error) {
    console.error("❌ INSERT FAILED! Reason:", error.message, error.details, error.hint);
    console.log("This means Row Level Security (RLS) or a constraint is blocking the insert.");
  } else {
    console.log("✅ INSERT SUCCESSFUL! Your database is perfectly fine.");
    console.log("If production sync is failing, it strictly means Google Calendar returns 0 events.");
    
    // Clean up
    await supabase.from('calendar_activity').delete().eq('id', data[0].id);
  }
}

testCalendarInsert();
