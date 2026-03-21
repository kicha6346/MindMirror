import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { calculateBurnoutScore } from '@/lib/scoring';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    const uid = userId || '00000000-0000-0000-0000-000000000000';

    // Fetch the current metrics to feed the AI
    const metrics = await calculateBurnoutScore(uid, new Date());

    const prompt = `
    You are MindMirror, an elite AI burnout-prevention coach.
    Tone: Direct, empathetic, clinical, NEVER shame-based.
    Constraints: EXTREMELY concise. No fluff. No greetings. Get straight to the point.

    User's Metrics (0-100):
    - Burnout Risk: ${metrics.score}
    - Work Intensity: ${metrics.workIntensity.toFixed(1)}
    - Night Activity: ${metrics.nightActivity.toFixed(1)}
    - Context Switching: ${metrics.distractionPenalty.toFixed(1)}
    - Recovery Deficit: ${metrics.recoveryDeficit.toFixed(1)}
    
    Context:
    - Meetings: ${metrics.rawMetrics.calendarMinutes} min
    - Commits: ${metrics.rawMetrics.githubCommits}
    - Deep Focus Interruptions: ${metrics.rawMetrics.pomoTabSwitches}
    
    Task:
    You MUST output EXACTLY two lines.
    Line 1: A useful observation correlating their specific metrics.
    Line 2: Exactly ONE actionable step to improve their burnout risk.
    `;

    // Only hit Gemini if key exists (fallback for hackathon)
    if (!process.env.GEMINI_API_KEY) {
       return NextResponse.json({ 
         insight: `(Mock Insight) You've been operating with a burnout risk of ${metrics.score}. Consider adding 1 recovery day and reducing night activity.` 
       });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: prompt,
        temperature: 0.7,
        maxOutputTokens: 80,
      }
    });

    return NextResponse.json({ insight: response.text });

  } catch (error) {
    console.error('Gemini Error:', error);
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
  }
}
