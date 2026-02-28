import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { calculateBurnoutScore } from '@/lib/scoring';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    const uid = userId || '00000000-0000-0000-0000-000000000000';

    // Fetch the current metrics to feed the AI
    const metrics = await calculateBurnoutScore(uid, new Date());

    const prompt = `
    You are an AI behavior intelligence system called MindMirror. 
    Your tone is: Calm by default, confronting when burnout risk is high, but NEVER shame-based. No guilt language.
    
    The user's current behavioral metrics (0-100 scale, where 100 means high intensity of that metric):
    - Overall Burnout Risk: ${metrics.score}
    - Work Intensity: ${metrics.workIntensity.toFixed(1)}
    - Night Activity (late working): ${metrics.nightActivity.toFixed(1)}
    - Social Isolation: ${metrics.socialIsolation.toFixed(1)}
    - Recovery Deficit: ${metrics.recoveryDeficit.toFixed(1)}
    
    Based on this data, provide a 2-3 sentence personalized insight directed at the user. 
    Focus on correlation between these metrics (e.g. "Your late-night work correlates with recovery deficits"). 
    Always provide actionable, empathetic advice.
    `;

    // Only hit OpenAI if key exists (fallback for hackathon)
    if (!process.env.OPENAI_API_KEY) {
       return NextResponse.json({ 
         insight: `(Mock Insight) You've been operating with a burnout risk of ${metrics.score}. Consider adding 1 recovery day and reducing night activity.` 
       });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 150,
    });

    return NextResponse.json({ insight: completion.choices[0].message.content });

  } catch (error) {
    console.error('OpenAI Error:', error);
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
  }
}
