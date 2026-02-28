import { supabase } from '@/lib/supabase';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

/**
 * Normalizes a value to a 0-100 scale based on a given max threshold.
 */
function normalize(value: number, maxThreshold: number) {
  const norm = (value / maxThreshold) * 100;
  return Math.min(Math.max(norm, 0), 100);
}

/**
 * Calculates burnout score for a given user and date.
 */
export async function calculateBurnoutScore(userId: string, date: Date) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const start = startOfDay(date).toISOString();
  const end = endOfDay(date).toISOString();

  // 1. Get Browser Usage for the day
  const { data: usageData } = await supabase
    .from('browser_usage')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', start)
    .lte('timestamp', end);

  let workSeconds = 0;
  let socialSeconds = 0;
  let entertainmentSeconds = 0;
  let nightSeconds = 0; // Usage between 11 PM and 3 AM

  if (usageData) {
    usageData.forEach((row) => {
      const tsHour = new Date(row.timestamp).getHours();
      
      // Calculate night activity (23:00 to 03:00)
      if (tsHour >= 23 || tsHour < 3) {
        nightSeconds += row.duration_seconds;
      }

      if (row.category === 'work' || row.category === 'learning') {
        workSeconds += row.duration_seconds;
      } else if (row.category === 'social') {
        socialSeconds += row.duration_seconds;
      } else if (row.category === 'entertainment') {
        entertainmentSeconds += row.duration_seconds;
      }
    });
  }

  // Define thresholds to normalize
  const WORK_DEF = 8 * 3600; // 8 hours of work -> 100 on work intensity
  const RECOVERY_DEF = 3 * 3600; // 3 hours of recovery -> 100 on recovery score
  const NIGHT_DEF = 2 * 3600; // 2 hours at night -> 100 on night activity
  const SOCIAL_IDEAL = 1.5 * 3600; // Ideal social is 1.5 hours, less means isolation

  const workIntensity = normalize(workSeconds, WORK_DEF);
  
  // If recovery is high, deficit is low
  const recoveryScoreMax = (entertainmentSeconds / RECOVERY_DEF) * 100;
  const recoveryDeficit = Math.min(Math.max(100 - recoveryScoreMax, 0), 100); 

  const nightActivity = normalize(nightSeconds, NIGHT_DEF);
  
  // Social Isolation (if socialSeconds is less than 1.5h, isolation rises)
  const socialScoreMax = (socialSeconds / SOCIAL_IDEAL) * 100;
  const socialIsolation = Math.min(Math.max(100 - socialScoreMax, 0), 100);

  // Formula: (Work * 0.4) + (Night * 0.2) + (Social * 0.2) + (Recovery Deficit * 0.2)
  let burnoutRisk = Math.round(
    (workIntensity * 0.4) +
    (nightActivity * 0.2) +
    (socialIsolation * 0.2) +
    (recoveryDeficit * 0.2)
  );
  
  // Cap at 100
  burnoutRisk = Math.min(Math.max(burnoutRisk, 0), 100);

  // Save to DB
  await supabase.from('burnout_scores').upsert({
    user_id: userId,
    daily_score: burnoutRisk,
    weekly_score: burnoutRisk, // Ideally computed as 7-day avg, simplified here
    computed_at: new Date().toISOString()
  }, { onConflict: 'user_id, computed_at' }); // Requires unique composite or handles multiple

  return {
    score: burnoutRisk,
    workIntensity,
    nightActivity,
    socialIsolation,
    recoveryDeficit
  };
}

/**
 * Gets 7-day rolling average
 */
export async function getWeeklyMetrics(userId: string) {
  const sevenDaysAgo = subDays(new Date(), 7).toISOString();
  
  const { data } = await supabase
    .from('burnout_scores')
    .select('daily_score, computed_at')
    .eq('user_id', userId)
    .gte('computed_at', sevenDaysAgo)
    .order('computed_at', { ascending: true });
    
  return data || [];
}
