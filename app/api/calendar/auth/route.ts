import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/calendar/callback`;
  
  if (!clientId) {
    return NextResponse.json({ error: 'Google Client ID not configured in .env.local' }, { status: 500 });
  }

  const scope = 'https://www.googleapis.com/auth/calendar.readonly';
  const state = encodeURIComponent(userId);

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;

  return NextResponse.redirect(authUrl);
}
