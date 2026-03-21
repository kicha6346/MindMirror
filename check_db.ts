import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase keys in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log("🔍 Fetching today's browser usage data from Supabase...");
  console.log("-------------------------------------------------------");

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('browser_usage')
    .select('domain, duration_seconds, max_concurrent_tabs, doomscroll_cycles')
    .eq('date', today)
    .order('duration_seconds', { ascending: false });

  if (error) {
    console.error("❌ Database Error:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("📭 No data recorded for today yet. Make sure the extension is running and the user is logged in.");
    return;
  }

  // Calculate totals
  let totalDuration = 0;
  let totalDoomscrolls = 0;
  let highestTabs = 0;

  console.table(data);

  data.forEach(row => {
    totalDuration += row.duration_seconds;
    totalDoomscrolls += (row.doomscroll_cycles || 0);
    if (row.max_concurrent_tabs > highestTabs) highestTabs = row.max_concurrent_tabs;
  });

  console.log("-------------------------------------------------------");
  console.log(`📊 TOTALS FOR TODAY (${today}):`);
  console.log(`   ⏱️ Total Tracked Time: ${Math.round(totalDuration / 60)} minutes`);
  console.log(`   🧟‍♂️ Total Doomscroll Cycles: ${totalDoomscrolls}`);
  console.log(`   📚 Highest Tab Hoarding: ${highestTabs} tabs`);

  console.log("\n\n=======================================================");
  console.log("🍅 Fetching Pomodoro Sessions from Supabase...");
  console.log("-------------------------------------------------------");

  const { data: pomoData, error: pomoError } = await supabase
    .from('pomodoro_sessions')
    .select('start_time, focus_minutes, break_minutes, distractions, doomscroll_cycles, tab_switches, final_focus_score')
    .order('start_time', { ascending: false });

  if (pomoError) {
    console.error("❌ Pomodoro Database Error:", pomoError.message);
  } else if (!pomoData || pomoData.length === 0) {
    console.log("📭 No Pomodoro sessions recorded yet.");
  } else {
    console.table(pomoData);
  }
}

checkDatabase();
