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
      .from('user_blocklists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, blocklist: data });
  } catch (error) {
    console.error('Blocklist GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, domain } = body;

    if (!userId || !domain) {
      return NextResponse.json({ error: 'Missing userId or domain' }, { status: 400 });
    }

    // Clean up domain (e.g. https://www.instagram.com -> instagram.com)
    let cleanDomain = domain.toLowerCase().trim();
    try {
      if (!cleanDomain.startsWith('http')) {
        cleanDomain = 'https://' + cleanDomain;
      }
      const url = new URL(cleanDomain);
      cleanDomain = url.hostname.replace(/^www\./, '');
    } catch(e) {
      // Fallback if URL parsing fails
      cleanDomain = domain.toLowerCase().trim().replace(/^www\./, '');
    }

    const { data, error } = await supabase
      .from('user_blocklists')
      .insert({
        user_id: userId,
        domain: cleanDomain,
        is_active: true
      })
      .select()
      .single();

    if (error) {
       // Check for unique constraint violation
       if (error.code === '23505') {
         return NextResponse.json({ error: 'Domain is already in your blocklist' }, { status: 409 });
       }
       throw error;
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Blocklist POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return NextResponse.json({ error: 'Missing id or userId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_blocklists')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blocklist DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Optional toggle active status
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, userId, is_active } = body;

    if (!id || !userId || is_active === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_blocklists')
      .update({ is_active })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: data });
  } catch (error) {
    console.error('Blocklist PATCH Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
