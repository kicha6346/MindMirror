import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const userId = searchParams.get('state');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/?error=missing_code_or_user', baseUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${baseUrl}/api/calendar/callback`;

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('Failed to get access token:', tokenData);
      return NextResponse.redirect(new URL('/?error=calendar_auth_failed', baseUrl));
    }

    const decodedUserId = decodeURIComponent(userId);

    // Save the refresh token to allow continuous background syncing
    if (tokenData.refresh_token) {
      const { data: existingUser } = await supabase.from('user_integrations').select('id').eq('user_id', decodedUserId).single();
      if (existingUser) {
        await supabase.from('user_integrations').update({ google_refresh_token: tokenData.refresh_token }).eq('user_id', decodedUserId);
      } else {
        await supabase.from('user_integrations').insert({ user_id: decodedUserId, google_refresh_token: tokenData.refresh_token });
      }
    }

    // 2. Fetch calendar events for an expanded 60-day window (30 days past, 30 days future)
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 30);

    const eventsResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const eventsData = await eventsResponse.json();
    const events = eventsData.items || [];

    // 3. Process events: Map them directly to the new database schema
    const recordsToInsert: any[] = [];

    events.forEach((event: any) => {
      // Handle both specific time events and all-day events
      const startDateTime = event.start?.dateTime; // Strictly require dateTime, ignore all-day
      const endDateTime = event.end?.dateTime;
      
      if (!startDateTime || !endDateTime) return;
      
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      
      const dayOfWeek = start.getDay(); // 0 is Sunday, 6 is Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const durationMs = end.getTime() - start.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));

      // Filter: Ignore tiny 0 minute errors or massive multi-day blocks
      if (durationMinutes > 0 && durationMinutes < 1440) {
         recordsToInsert.push({
           user_id: decodedUserId,
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
        // Upsert events based on the unique user_id and event_id constraint
        const { error: insertError } = await supabase
          .from('calendar_activity')
          .upsert(recordsToInsert, { onConflict: 'user_id, event_id' });
          
        if (insertError) {
          console.error("Supabase Upsert Error:", insertError);
          throw insertError;
        }
        
        console.log(`Successfully synced ${recordsToInsert.length} calendar events for user ${decodedUserId}`);
    } else {
        console.log(`No valid calendar events found in the 60-day window for user ${decodedUserId}. Injecting placeholder.`);
        
        // Push a dummy placeholder event so the UI flips to "Connected"
        await supabase
          .from('calendar_activity')
          .upsert([{
             user_id: decodedUserId,
             event_id: `placeholder-${Date.now()}`,
             summary: 'MindMirror Connection Established',
             description: 'You have successfully connected your Google Calendar.',
             start_time: new Date().toISOString(),
             end_time: new Date().toISOString(),
             work_minutes: 0,
             weekend_work: false
          }], { onConflict: 'user_id, event_id' });
    }

    return NextResponse.redirect(new URL('/?sync=calendar_success', baseUrl));

  } catch (err) {
    console.error('Calendar sync error:', err);
    return NextResponse.redirect(new URL('/?error=calendar_sync_failed', baseUrl));
  }
}
