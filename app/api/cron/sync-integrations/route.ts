import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// This endpoint should be triggered periodically (e.g. via Vercel Cron or a local script)
// It loops through all user_integrations and calls their respective sync logic.
export async function GET(req: Request) {
  try {
    // 1. Fetch all configured integrations
    const { data: users, error } = await supabase
      .from('user_integrations')
      .select('user_id, github_username, leetcode_username, google_refresh_token');

    if (error) {
       console.error('[Cron] Failed to fetch users for sync', error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
       return NextResponse.json({ message: 'No users configured for sync.' });
    }

    console.log(`[Cron] Starting background sync for ${users.length} users...`);

    let githubSuccess = 0;
    let leetcodeSuccess = 0;
    let calendarSuccess = 0;

    for (const u of users) {
      const todayDateStr = new Date().toISOString().split('T')[0];

      // --- SYNC GITHUB ---
      if (u.github_username) {
        try {
          const url = `https://api.github.com/users/${u.github_username}/events?per_page=50`;
          const response = await fetch(url, {
             headers: { 'User-Agent': 'MindMirror-Sync', 'Accept': 'application/vnd.github.v3+json' },
             next: { revalidate: 0 } // Don't cache cron requests
          });
          
          if (response.ok) {
            const events = await response.json();
            
            // Only aggregate TODAY'S data (since user requested continuous syncing from this exact moment forward)
            let dailyCommits = 0;
            let dailyPrs = 0;
            let dailyIssues = 0;

            events.forEach((event: any) => {
              const dateStr = event.created_at.split('T')[0];
              if (dateStr === todayDateStr) {
                 if (event.type === 'PushEvent') {
                    dailyCommits += (event.payload.commits ? event.payload.commits.length : 0);
                 } else if (event.type === 'PullRequestEvent' && event.payload.action === 'opened') {
                    dailyPrs += 1;
                 } else if (event.type === 'IssuesEvent' && event.payload.action === 'opened') {
                    dailyIssues += 1;
                 }
              }
            });

            // Upsert today's data explicitly
            await supabase.from('github_activity').upsert({
               user_id: u.user_id,
               date: todayDateStr,
               commit_count: dailyCommits,
               pr_count: dailyPrs,
               issue_count: dailyIssues
            }, { onConflict: 'user_id, date' });
            
            githubSuccess++;
          }
        } catch(e) {
          console.error(`[Cron] GitHub sync failed for ${u.github_username}`, e);
        }
      }

      // --- SYNC LEETCODE ---
      if (u.leetcode_username) {
         try {
           const url = `https://alfa-leetcode-api.onrender.com/${u.leetcode_username}/calendar`;
           const response = await fetch(url, { next: { revalidate: 0 } });
           
           if (response.ok) {
              const calendarData = await response.json();
              if (calendarData.submissionCalendar) {
                 const submissionMap = JSON.parse(calendarData.submissionCalendar);
                 
                 // Look up ONLY today's timestamp (or roughly today's 24h window)
                 let todayTotalSolved = 0;
                 
                 // Convert today to the start of the UTC day in unix time
                 const now = new Date();
                 const startOfDayUnix = Math.floor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime() / 1000);
                 
                 // Alfa API keys the JSON with unix strings. We aggregate any submission that happened today.
                 for (const unixStr of Object.keys(submissionMap)) {
                    const timestamp = parseInt(unixStr, 10);
                    const dateStr = new Date(timestamp * 1000).toISOString().split('T')[0];
                    if (dateStr === todayDateStr) {
                       todayTotalSolved += submissionMap[unixStr];
                    }
                 }

                 await supabase.from('leetcode_activity').upsert({
                    user_id: u.user_id,
                    date: todayDateStr,
                    total_solved: todayTotalSolved
                 }, { onConflict: 'user_id, date' });

                 leetcodeSuccess++;
              }
           }
         } catch(e) {
            console.error(`[Cron] Leetcode sync failed for ${u.leetcode_username}`, e);
         }
      }

      // --- SYNC GOOGLE CALENDAR (Continuous) ---
      if (u.google_refresh_token) {
        try {
          const clientId = process.env.GOOGLE_CLIENT_ID;
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

          if (clientId && clientSecret) {
            // Get new access token
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: u.google_refresh_token,
                grant_type: 'refresh_token',
              }),
            });

            const tokenData = await tokenResponse.json();
            if (tokenData.access_token) {
              const timeMin = new Date();
              timeMin.setDate(timeMin.getDate() - 30);
              timeMin.setHours(0, 0, 0, 0);

              const timeMax = new Date();
              timeMax.setDate(timeMax.getDate() + 30);

              const eventsResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
              });

              if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json();
                const events = eventsData.items || [];
                const recordsToInsert: any[] = [];

                events.forEach((event: any) => {
                  const startDateTime = event.start?.dateTime;
                  const endDateTime = event.end?.dateTime;
                  if (!startDateTime || !endDateTime) return;
                  
                  const start = new Date(startDateTime);
                  const end = new Date(endDateTime);
                  const dayOfWeek = start.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const durationMs = end.getTime() - start.getTime();
                  const durationMinutes = Math.floor(durationMs / (1000 * 60));

                  if (durationMinutes > 0 && durationMinutes < 1440) {
                     recordsToInsert.push({
                       user_id: u.user_id,
                       event_id: event.id,
                       summary: event.summary || 'Untitled Event',
                       description: event.description || '',
                       start_time: startDateTime,
                       end_time: endDateTime,
                       work_minutes: durationMinutes,
                       weekend_work: isWeekend
                     });
                  }
                });

                if (recordsToInsert.length > 0) {
                    await supabase
                      .from('calendar_activity')
                      .upsert(recordsToInsert, { onConflict: 'user_id, event_id' });
                }
                calendarSuccess++;
              }
            }
          }
        } catch(e) {
          console.error(`[Cron] Google Calendar sync failed for ${u.user_id}`, e);
        }
      }
    }

    return NextResponse.json({ 
       success: true, 
       message: `Cron sync complete. Updated ${githubSuccess} GitHub, ${leetcodeSuccess} LeetCode, and ${calendarSuccess} Calendar trackers.`
    });

  } catch (error: any) {
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
