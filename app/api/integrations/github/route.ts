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
      await supabase.from('user_integrations').update({ github_username: username }).eq('user_id', userId);
    } else {
      await supabase.from('user_integrations').insert({ user_id: userId, github_username: username });
    }

    console.log(`[GitHub Sync] Fetching recent public events for ${username}...`);
    
    // Fetch up to 300 recent public events (GitHub REST API allows 100 per page, up to 3 pages for unauth)
    const url = `https://api.github.com/users/${username}/events?per_page=100`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MindMirror-Burnout-Tracker',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
       if (response.status === 404) return NextResponse.json({ error: 'GitHub user not found' }, { status: 404 });
       if (response.status === 403) return NextResponse.json({ error: 'GitHub API rate limit exceeded. Try again later.' }, { status: 403 });
       throw new Error(`GitHub API returned ${response.status}`);
    }

    const events = await response.json();
    
    // Aggregate by Date
    const dailyData: Record<string, { commits: number, prs: number, issues: number, latest_commit_timestamp: string | null }> = {};

    events.forEach((event: any) => {
      // GitHub returns UTC timestamps
      const dateStr = event.created_at.split('T')[0];
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { commits: 0, prs: 0, issues: 0, latest_commit_timestamp: null };
      }

      if (event.type === 'PushEvent') {
        const commitCount = event.payload.commits ? event.payload.commits.length : 0;
        dailyData[dateStr].commits += commitCount;
        
        // Track the absolute latest commit timestamp for that day for Sleep Debt calculation
        if (!dailyData[dateStr].latest_commit_timestamp || new Date(event.created_at) > new Date(dailyData[dateStr].latest_commit_timestamp!)) {
           dailyData[dateStr].latest_commit_timestamp = event.created_at;
        }
      } else if (event.type === 'PullRequestEvent' && event.payload.action === 'opened') {
        dailyData[dateStr].prs += 1;
      } else if (event.type === 'IssuesEvent' && event.payload.action === 'opened') {
        dailyData[dateStr].issues += 1;
      }
    });

    const recordsToInsert = Object.keys(dailyData).map(date => ({
      user_id: userId,
      date: date,
      commit_count: dailyData[date].commits,
      pr_count: dailyData[date].prs,
      issue_count: dailyData[date].issues,
      latest_commit_timestamp: dailyData[date].latest_commit_timestamp
    }));

    if (recordsToInsert.length > 0) {
      const { error } = await supabase
        .from('github_activity')
        .upsert(recordsToInsert, { onConflict: 'user_id, date' });

      if (error) {
         console.error('[GitHub Sync] DB UPSERT ERROR:', error);
         throw error;
      }
    }

    return NextResponse.json({ 
      success: true, 
      syncedDays: recordsToInsert.length,
      message: `Successfully synced ${recordsToInsert.length} days of GitHub activity.`
    });

  } catch (error: any) {
    console.error('[GitHub Sync] FATAL ERROR:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
