import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { subDays, format } from 'date-fns';
import { calculateBurnoutScore } from '@/lib/scoring';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Step 1: Fetch persisted scores from the burnout_scores table
    const since = format(subDays(new Date(), days), 'yyyy-MM-dd');
    const { data: historicalScores, error } = await supabase
      .from('burnout_scores')
      .select('date, score, work_intensity, recovery_deficit, distraction_penalty, night_activity, sleep_debt_penalty')
      .eq('user_id', userId)
      .gte('date', since)
      .order('date', { ascending: true });

    if (error) throw error;

    // Step 2: Fetch raw category duration seconds for the same time period
    // We group by date and category to build the new Stacked Bar Chart
    const { data: rawUsage, error: usageError } = await supabase
      .from('browser_usage')
      .select('date, category, duration_seconds')
      .eq('user_id', userId)
      .gte('date', since);

    if (usageError) {
      console.warn('[Performance API] Failed to fetch raw browser usage for 30-day breakdown:', usageError.message);
    }

    // Step 2: If we have fewer than 2 days of persisted data, backfill by computing scores
    // This runs the first time a user loads the Performance tab
    if (!historicalScores || historicalScores.length < 2) {
      const backfilledScores = [];
      for (let i = days - 1; i >= 0; i--) {
        const targetDate = subDays(new Date(), i);
        const dateStr = format(targetDate, 'yyyy-MM-dd');
        
        // Skip if we already have a persisted record
        const alreadyExists = historicalScores?.some(s => s.date === dateStr);
        if (alreadyExists) continue;

        const stats = await calculateBurnoutScore(userId, targetDate);
        
        // Persist it
        await supabase.from('burnout_scores').upsert({
          user_id: userId,
          date: dateStr,
          score: stats.score,
          work_intensity: stats.workIntensity,
          recovery_deficit: stats.recoveryDeficit,
          distraction_penalty: stats.distractionPenalty,
          night_activity: stats.nightActivity,
          sleep_debt_penalty: stats.sleepDebtPenalty,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, date' });
        
        backfilledScores.push({
          date: dateStr,
          score: stats.score,
          work_intensity: stats.workIntensity,
          recovery_deficit: stats.recoveryDeficit,
          distraction_penalty: stats.distractionPenalty,
          night_activity: stats.nightActivity,
          sleep_debt_penalty: stats.sleepDebtPenalty
        });
      }

      // Merge and sort
      const allScores = [...(historicalScores || []), ...backfilledScores].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      return NextResponse.json({ success: true, history: attachCategorySeconds(allScores, rawUsage || []) });
    }

    return NextResponse.json({ success: true, history: attachCategorySeconds(historicalScores, rawUsage || []) });
    
  } catch (error: any) {
    console.error('[Performance API] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Helper to overlay the raw database seconds onto the abstract layout timeline
function attachCategorySeconds(timelineInfo: any[], rawUsage: any[]) {
  // Aggregate DB rows into a map of { 'YYYY-MM-DD': { work: 0, social: 0, entertainment: 0, other: 0 } }
  const aggregation: Record<string, { work: number; social: number; entertainment: number; other: number }> = {};
  
  for (const row of rawUsage || []) {
    if (!aggregation[row.date]) {
      aggregation[row.date] = { work: 0, social: 0, entertainment: 0, other: 0 };
    }
    const sec = row.duration_seconds || 0;
    if (row.category === 'learning' || row.category === 'work') {
      aggregation[row.date].work += sec;
    } else if (row.category === 'social') {
      aggregation[row.date].social += sec;
    } else if (row.category === 'entertainment') {
      aggregation[row.date].entertainment += sec;
    } else {
      aggregation[row.date].other += sec;
    }
  }

  // Map over the timeline and glue the seconds into each day packet to support the BarChart
  return timelineInfo.map((dayObj) => {
    const agg = aggregation[dayObj.date] || { work: 0, social: 0, entertainment: 0, other: 0 };
    return {
      ...dayObj,
      work_seconds: agg.work,
      social_seconds: agg.social,
      entertainment_seconds: agg.entertainment,
      other_seconds: agg.other
    };
  });
}
