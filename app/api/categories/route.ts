import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_custom_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // If table doesn't exist (42P01 or PGRST205) or Invalid UUID format (22P02)
    if (error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === '22P02')) {
      return NextResponse.json({ success: true, mappings: [] });
    }
    if (error) throw error;

    return NextResponse.json({ success: true, mappings: data });
  } catch (error) {
    console.error('CustomCategories GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, domain, category } = body;

    if (!userId || !domain || !category) {
      return NextResponse.json({ error: 'Missing userId, domain or category' }, { status: 400 });
    }

    // Clean up domain (e.g. https://www.youtube.com -> youtube.com)
    let cleanDomain = domain.toLowerCase().trim();
    try {
      if (!cleanDomain.startsWith('http')) {
        cleanDomain = 'https://' + cleanDomain;
      }
      const url = new URL(cleanDomain);
      cleanDomain = url.hostname.replace(/^www\./, '');
    } catch (e) {
      cleanDomain = domain.toLowerCase().trim().replace(/^www\./, '');
    }

    const validCategories = ['work', 'learning', 'social', 'entertainment', 'other'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Invalid category choice' }, { status: 400 });
    }

    // Add to mapping
    const { data, error } = await supabase
      .from('user_custom_categories')
      .upsert({ 
        user_id: userId, 
        domain: cleanDomain,
        category: category
      }, { onConflict: 'user_id, domain' })
      .select()
      .single();

    if (error) {
       // Check if table missing
       if (error.code === '42P01' || error.code === 'PGRST205') {
          return NextResponse.json({ 
            error: 'You need to create the table first. Open Supabase SQL Editor and run: CREATE TABLE user_custom_categories (id uuid default gen_random_uuid() primary key, user_id uuid not null, domain text not null, category text not null, created_at timestamp default now(), unique(user_id, domain));' 
          }, { status: 500 });
       }
       throw error;
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error: any) {
    console.error('CustomCategories POST Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_custom_categories')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CustomCategories DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
