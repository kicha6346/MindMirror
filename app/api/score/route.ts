import { NextResponse } from 'next/server';
import { calculateBurnoutScore, getWeeklyMetrics } from '@/lib/scoring';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000000'; // Mock ID

    const todayDate = new Date();
    const currentScore = await calculateBurnoutScore(userId, todayDate);
    
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
