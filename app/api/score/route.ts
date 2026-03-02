import { NextResponse } from 'next/server';
import { calculateBurnoutScore, getWeeklyMetrics } from '@/lib/scoring';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000000'; // Mock ID

    const todayDate = new Date();
    const currentScore = await calculateBurnoutScore(userId, todayDate);
    
    // Phase 21: Persist today's score into burnout_scores for 30-day historical tracking
    const dateStr = format(todayDate, 'yyyy-MM-dd');
    await supabase.from('burnout_scores').upsert({
      user_id: userId,
      date: dateStr,
      score: currentScore.score,
      work_intensity: currentScore.workIntensity,
      recovery_deficit: currentScore.recoveryDeficit,
      distraction_penalty: currentScore.distractionPenalty,
      night_activity: currentScore.nightActivity,
      sleep_debt_penalty: currentScore.sleepDebtPenalty,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, date' });
    
    // Also fetch 7 days
    const weeklyMetrics = await getWeeklyMetrics(userId);
    
    return NextResponse.json({
      success: true,
      current: currentScore,
      weekly: weeklyMetrics
    });
  } catch (error) {
    console.error('Scoring Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
