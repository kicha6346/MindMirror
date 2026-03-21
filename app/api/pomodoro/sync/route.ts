import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Ingest a completed or aborted Pomodoro Session
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      userId, 
      startTime, 
      endTime, 
      status, 
      targetMinutes, 
      completedMinutes, 
      breakMinutes,
      tabSwitches, 
      blockedVisits, 
      doomscrollCycles, 
      distractionLog, 
      focusScore 
    } = body;

    if (!userId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing core session data' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .insert({
        user_id: userId,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        status: status || 'completed',
        
        // Populate BOTH new columns and legacy redundant columns securely 
        // to prevent Supabase from applying the "25 / 5" default hardware values.
        target_minutes: targetMinutes || 25,
        completed_minutes: completedMinutes || 0,
        focus_minutes: targetMinutes || 25,
        break_minutes: breakMinutes || 5,
        
        total_tab_switches: tabSwitches || 0,
        tab_switches: tabSwitches || 0,
        
        blocked_site_visits: blockedVisits || 0,
        distractions: blockedVisits || 0,
        
        doomscroll_cycles: doomscrollCycles || 0,
        
        focus_score: focusScore || 0,
        final_focus_score: focusScore || 0,
        
        detailed_action_log: distractionLog || []
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Pomodoro Sync Error:", error);
      throw error;
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error('Pomodoro Sync POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
