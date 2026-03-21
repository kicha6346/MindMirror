import { supabase } from '@/lib/supabase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

/**
 * Normalizes a value to a 0-100 scale based on a given max threshold.
 */
function normalize(value: number, maxThreshold: number) {
  const norm = (value / maxThreshold) * 100;
  return Math.min(Math.max(norm, 0), 100);
}

/**
 * Calculates master burnout score for a given user and date, utilizing 5 data streams.
 */
export async function calculateBurnoutScore(userId: string, date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const start = startOfDay(date).toISOString();
  const end = endOfDay(date).toISOString();
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // ==========================================
  // 1. DATA AGGREGATION
  // ==========================================
  
  // A. BROWSER USAGE
  const { data: usageData } = await supabase
    .from('browser_usage')
    .select('duration_seconds, category, last_updated')
    .eq('user_id', userId)
    .eq('date', dateStr);

  let browserWorkSeconds = 0;
  let browserSocialSeconds = 0;
  let browserEntertainmentSeconds = 0;
  let browserNightSeconds = 0; 

  if (usageData) {
    usageData.forEach((row) => {
      // Use last_updated for night activity heuristic
      const tsHour = row.last_updated ? new Date(row.last_updated).getHours() : 12;
      // Night activity (23:00 to 04:00)
      if (tsHour >= 23 || tsHour < 4) {
        browserNightSeconds += row.duration_seconds;
      }
      if (row.category === 'work' || row.category === 'learning') {
        browserWorkSeconds += row.duration_seconds;
      } else if (row.category === 'social') {
        browserSocialSeconds += row.duration_seconds;
      } else if (row.category === 'entertainment') {
        browserEntertainmentSeconds += row.duration_seconds;
      }
    });
  }

  // B. CALENDAR ACTIVITY
  const { data: calData } = await supabase
    .from('calendar_activity')
    .select('work_minutes, weekend_work')
    .eq('user_id', userId)
    .gte('start_time', start)
    .lte('start_time', end);

  let calendarWorkMinutes = 0;
  let calendarWeekendPenalty = false;
  
  if (calData) {
    calData.forEach(row => {
      calendarWorkMinutes += row.work_minutes || 0;
      if (row.weekend_work) calendarWeekendPenalty = true;
    });
  }

  // C. POMODORO SESSIONS (Distractions)
  const { data: pomoData } = await supabase
    .from('pomodoro_sessions')
    .select('tab_switches, doomscroll_cycles, distractions')
    .eq('user_id', userId)
    .gte('start_time', start)
    .lte('start_time', end);

  let pomoTabSwitches = 0;
  let pomoDoomscrolls = 0;
  let pomoDistractions = 0;

  if (pomoData) {
    pomoData.forEach(row => {
      pomoTabSwitches += row.tab_switches || 0;
      pomoDoomscrolls += row.doomscroll_cycles || 0;
      pomoDistractions += row.distractions || 0;
    });
  }

  // D. GITHUB ACTIVITY
  const { data: gitData } = await supabase.from('github_activity').select('commit_count, pr_count, issue_count, latest_commit_timestamp').eq('user_id', userId).eq('date', dateStr).single();
  const githubCommits = gitData?.commit_count || 0;
  const githubPRs = gitData?.pr_count || 0;
  const latestCommitTs = gitData?.latest_commit_timestamp || null;

  // E. LEETCODE ACTIVITY
  const { data: leetData } = await supabase.from('leetcode_activity').select('total_solved, latest_submission_timestamp').eq('user_id', userId).eq('date', dateStr).single();
  const leetcodeSolved = leetData?.total_solved || 0;
  const leetLatestTs = leetData?.latest_submission_timestamp || null;


  // ==========================================
  // 2. ALGORITHMIC TRANSFORMATION
  // ==========================================

  // --- 1. Work Intensity (0-100) ---
  // Baseline screen time (8 hours = 100)
  const baseIntensity = normalize(browserWorkSeconds, 8 * 3600); 
  
  // Meeting multiplier (up to 30 bonus points for 4h+ of meetings)
  const meetingLoad = normalize(calendarWorkMinutes, 4 * 60) * 0.30;
  
  // Code burst multiplier (up to 20 bonus points for 10+ commits/PRs + 3+ leetcode)
  const codeLoad = normalize(githubCommits + (githubPRs * 2) + (leetcodeSolved * 3), 15) * 0.20;

  const workIntensity = Math.min(baseIntensity + meetingLoad + codeLoad, 100);


  // --- 2. Recovery Deficit (0-100) ---
  // Ideal recovery is 3 hours of non-work screen time or complete offline time.
  const recoveryScoreMax = normalize(browserEntertainmentSeconds + browserSocialSeconds, 3 * 3600);
  let recoveryDeficit = 100 - recoveryScoreMax;
  
  // Massive penalty if working on the weekend
  if (isWeekend && (browserWorkSeconds > 3600 || calendarWeekendPenalty || githubCommits > 0)) {
     recoveryDeficit = Math.min(recoveryDeficit + 50, 100); 
  }


  // --- 3. Distraction / Context Switch Penalty (0-100) ---
  // Ideal is 0. Penalty rises with rapid focus-breaking.
  // 10 tab switches, 3 doomscrolls, or 3 blocklist hits maxes out distraction metric.
  // UPDATE: We are increasing the severity of doomscrolling and blocklist hits to mathematically 
  // affect Burnout Risk much harder than normal work.
  const contextSwitchingScore = normalize(
     (pomoTabSwitches * 5) + (pomoDoomscrolls * 50) + (pomoDistractions * 50), 
     100
  );
  

  // --- 4. Night Activity Index (0-100) ---
  // 2 hours at night -> 100 severity on sleep degradation
  const nightActivity = normalize(browserNightSeconds, 2 * 3600);


  // --- 5. Sleep Debt Penalty & Actions Array (Phase 20) ---
  let sleepDebtPenalty = 0;
  let actions: string[] = [];

  if (latestCommitTs) {
    const commitHour = new Date(latestCommitTs).getHours();
    // If commit happens between 1:00 AM and 5:00 AM local time
    if (commitHour >= 1 && commitHour < 5) {
      sleepDebtPenalty = 100; // Max severity
      actions.push(`🔴 Detected ${format(new Date(latestCommitTs), 'h:mm a')} GitHub commit. Inferred heavy Sleep Debt.`);
    }
  }

  if (leetLatestTs) {
    const leetHour = new Date(leetLatestTs).getHours();
    if (leetHour >= 1 && leetHour < 5) {
      sleepDebtPenalty = 100; // Max severity
      actions.push(`🔴 Detected ${format(new Date(leetLatestTs), 'h:mm a')} LeetCode submission. Inferred heavy Sleep Debt.`);
    }
  }


  // ==========================================
  // 3. MASTER SYNTHESIS
  // ==========================================
  // Formula: (Work * 0.40) + (Recovery Deficit * 0.25) + (Distraction * 0.15) + (Night * 0.10) + (Sleep Debt * 0.10)
  
  let burnoutRisk = Math.round(
    (workIntensity * 0.40) +
    (recoveryDeficit * 0.25) +
    (contextSwitchingScore * 0.15) +
    (nightActivity * 0.10) +
    (sleepDebtPenalty * 0.10)
  );
  
  burnoutRisk = Math.min(Math.max(burnoutRisk, 0), 100);

  // Populate dynamic environmental override actions for the UI
  if (burnoutRisk >= 75) {
     actions.push(`🔴 Burnout Risk hit ${burnoutRisk}/100. Injected contextual Breathing Exercise into browser.`);
  }

  if (sleepDebtPenalty > 0) {
     actions.push(`🟢 Overwrote Pomodoro Break setting from 5m -> 15m to force recovery.`);
  }

  return {
    score: burnoutRisk,
    workIntensity: Math.round(workIntensity),
    recoveryDeficit: Math.round(recoveryDeficit),
    distractionPenalty: Math.round(contextSwitchingScore),
    nightActivity: Math.round(nightActivity),
    sleepDebtPenalty: Math.round(sleepDebtPenalty),
    actions,
    rawMetrics: {
      calendarMinutes: calendarWorkMinutes,
      githubCommits,
      leetcodeSolved,
      pomoTabSwitches
    },
    // Supply RAW SECONDS to the frontend to draw the accurate Pie Chart
    distribution: {
      work: browserWorkSeconds,
      social: browserSocialSeconds,
      entertainment: browserEntertainmentSeconds,
      other: Math.max(0, browserNightSeconds) // Fallback for unmatched/other time if needed
    }
  };
}

/**
 * Gets 7-day rolling average (Dynamically calculated for Dashboard charts)
 */
export async function getWeeklyMetrics(userId: string) {
  const weeklyData = [];
  
  // Loop 7 days backwards
  for (let i = 6; i >= 0; i--) {
     const targetDate = subDays(new Date(), i);
     const stats = await calculateBurnoutScore(userId, targetDate);
     weeklyData.push({
       date: format(targetDate, 'EEE'), // Mon, Tue, etc
       fullDate: format(targetDate, 'yyyy-MM-dd'),
       score: stats.score,
       work: stats.workIntensity,
       recovery: stats.recoveryDeficit,
       distraction: stats.distractionPenalty,
       night: stats.nightActivity
     });
  }
  
  return weeklyData;
}
