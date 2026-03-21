import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, usage } = body;

    if (!user_id || !usage || !Array.isArray(usage)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Format data for bulk insert
    const records = usage.map((item: any) => ({
      user_id,
      domain: item.domain,
      category: item.category,
      duration_seconds: item.duration_seconds,
      scroll_depth_pixels: item.scroll_depth_pixels || 0,
      max_concurrent_tabs: item.max_concurrent_tabs || 1,
      doomscroll_cycles: item.doomscroll_cycles || 0
    }));

    // Use UPSERT to accumulate duration and visits for the same domain on the same day
    for (const item of records) {
      const { error } = await supabase.rpc('increment_browser_usage', {
        p_user_id: item.user_id,
        p_domain: item.domain,
        p_category: item.category,
        p_duration: item.duration_seconds,
        p_scroll_depth: item.scroll_depth_pixels || 0,
        p_max_tabs: item.max_concurrent_tabs || 1,
        p_doomscroll_cycles: item.doomscroll_cycles || 0
      });

      // Fallback if RPC isn't created: manually upsert (Supabase JS doesn't natively do delta updates in upsert without RPC)
      // Since setting up an RPC dynamically via API is complex, we will fetch first, then upsert
      if (error && error.code !== 'PGRST202') {
         const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
         
         const { data: existing } = await supabase
           .from('browser_usage')
           .select('duration_seconds, visits, scroll_depth_pixels, max_concurrent_tabs, doomscroll_cycles')
           .eq('user_id', item.user_id)
           .eq('domain', item.domain)
           .eq('date', today)
           .single();
           
         await supabase
           .from('browser_usage')
           .upsert({
             user_id: item.user_id,
             domain: item.domain,
             date: today,
             category: item.category,
             duration_seconds: (existing?.duration_seconds || 0) + item.duration_seconds,
             visits: (existing?.visits || 0) + 1,
             scroll_depth_pixels: (existing?.scroll_depth_pixels || 0) + (item.scroll_depth_pixels || 0),
             max_concurrent_tabs: Math.max((existing?.max_concurrent_tabs || 1), (item.max_concurrent_tabs || 1)),
             doomscroll_cycles: (existing?.doomscroll_cycles || 0) + (item.doomscroll_cycles || 0),
             last_updated: new Date().toISOString()
           }, { onConflict: 'user_id, domain, date' });
      }
    }

    return NextResponse.json({ success: true, processed: records.length });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
