import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      user_id, 
      start_time, 
      end_time, 
      focus_minutes, 
      break_minutes, 
      distractions, 
      doomscroll_cycles, 
      tab_switches, 
      final_focus_score 
    } = body;

    // Validate required fields
    if (!user_id || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert the finalized Pomodoro session
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .insert([
        {
          user_id,
          start_time,
          end_time,
          focus_minutes: focus_minutes || 0,
          break_minutes: break_minutes || 0,
          distractions: distractions || 0,
          doomscroll_cycles: doomscroll_cycles || 0,
          tab_switches: tab_switches || 0,
          final_focus_score: final_focus_score !== undefined ? final_focus_score : 100
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase Insert Error (Pomodoro):', error);
      return NextResponse.json({ error: 'Database insert failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error('API Error (Pomodoro Ingest):', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
