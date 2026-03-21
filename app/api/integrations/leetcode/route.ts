import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { userId, username } = await req.json();

    if (!userId || !username) {
      return NextResponse.json({ error: 'Missing userId or username' }, { status: 400 });
    }

    // Safely insert or update the user_integrations table without blindly overwriting
    const { data: existingUser } = await supabase.from('user_integrations').select('id').eq('user_id', userId).single();
    if (existingUser) {
      await supabase.from('user_integrations').update({ leetcode_username: username }).eq('user_id', userId);
    } else {
      await supabase.from('user_integrations').insert({ user_id: userId, leetcode_username: username });
    }

    console.log(`[LeetCode Sync] Fetching calendar history for ${username}...`);
    
    // Fetch historical daily submission calendar from the Alfa LeetCode API
    const url = `https://alfa-leetcode-api.onrender.com/${username}/calendar`;
    const response = await fetch(url);

    if (!response.ok) {
       return NextResponse.json({ error: 'LeetCode user not found or API down' }, { status: response.status });
    }

    const calendarData = await response.json();
    if (!calendarData.submissionCalendar) {
       return NextResponse.json({ error: 'No submission data found for this user' }, { status: 404 });
    }

    // The API returns a JSON string mapping unix timestamps to submission counts
    let submissionMap: Record<string, number> = {};
    try {
        submissionMap = JSON.parse(calendarData.submissionCalendar);
    } catch(e) {
        console.error("Failed to parse submissionCalendar string");
    }
    
    // Fetch precise recent accepted submissions for Sleep Debt Timestamp tracking
    let acMap: Record<string, string> = {};
    try {
      const acResponse = await fetch(`https://alfa-leetcode-api.onrender.com/${username}/acSubmission`);
      if (acResponse.ok) {
        const acData = await acResponse.json();
        if (acData.submission && Array.isArray(acData.submission)) {
          acData.submission.forEach((sub: any) => {
            const ts = parseInt(sub.timestamp, 10);
            const d = new Date(ts * 1000).toISOString().split('T')[0];
            if (!acMap[d] || new Date(ts * 1000) > new Date(acMap[d])) {
               acMap[d] = new Date(ts * 1000).toISOString();
            }
          });
        }
      }
    } catch(e) { console.error("Could not fetch precise AC submissions for timestamps", e); }
    
    // Convert to an array of objects for Supabase historical backfill
    const recordsToInsert = Object.keys(submissionMap).map(unixStr => {
      const timestamp = parseInt(unixStr, 10);
      const date = new Date(timestamp * 1000).toISOString().split('T')[0];
      const count = submissionMap[unixStr];
      
      return {
        user_id: userId,
        date: date,
        total_solved: count,
        latest_submission_timestamp: acMap[date] || null
        // Note: The calendar API only returns total submissions per day, 
        // so we aggregate into total_solved leaving difficulty buckets at 0 for history.
      };
    });

    if (recordsToInsert.length > 0) {
      const { error } = await supabase
        .from('leetcode_activity')
        .upsert(recordsToInsert, { onConflict: 'user_id, date' });

      if (error) {
         console.error('[LeetCode Sync] DB UPSERT ERROR:', error);
         throw error;
      }
    }

    return NextResponse.json({ 
      success: true, 
      syncedDays: recordsToInsert.length,
      message: `Successfully synced ${recordsToInsert.length} days of LeetCode history.`
    });

  } catch (error: any) {
    console.error('[LeetCode Sync] FATAL ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
