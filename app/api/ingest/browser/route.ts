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
    }));

    const { error } = await supabase
      .from('browser_usage')
      .insert(records);

    if (error) {
      console.error('Error inserting browser usage:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, inserted: records.length });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
