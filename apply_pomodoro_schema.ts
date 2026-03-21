import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyPomodoroSchema() {
  console.log('--- EXECUTING POMODORO & BLOCKLIST SCHEMA MIGRATION ---');
  
  console.log(`\n\n\n\n\n\n========================================================`);
  console.log(`ATTENTION REQUIRED: MANUAL SQL EXECUTION NEEDED`);
  console.log(`========================================================`);
  console.log(`Your Supabase database needs the new blocklist table and pomodoro columns.`);
  console.log(`\nTo upgrade your database:`);
  console.log(`1. Go to https://supabase.com/dashboard/project/_/sql/new`);
  console.log(`2. Copy the entire contents of ` + path.resolve('supabase', 'migrate_pomodoro.sql'));
  console.log(`3. Paste it into the editor and click "RUN"`);
  console.log(`========================================================\n\n\n\n\n\n`);
  
  process.exit(0);
}

applyPomodoroSchema();
