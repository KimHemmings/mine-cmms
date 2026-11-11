import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAzureOpenAiEnv } from '@/utils/env';

const MAX_BODY_BYTES = 200_000;
const UPSTREAM_TIMEOUT_MS = 30_000;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.active || profile.role !== 'management') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const {
    shiftName,
    supervisor,
    weatherNotes,
    safetyNotes,
    manningNotes,
    priorityNotes,
    activeMachines,
    releasedMachines,
    watchItems,
  } = body;

  let azure;
  try {
    azure = getAzureOpenAiEnv();
  } catch (error) {
    console.error('[ai-handover] configuration error:', error);
    return NextResponse.json({ error: 'Summary service not configured' }, { status: 503 });
  }

  const systemPrompt = `You are an HME Maintenance Supervisor writing a concise, 8-to-10 line executive handover brief for the incoming shift supervisor.

CRITICAL INSTRUCTIONS:
- NEVER use the word "AI", "digest", or mention automation.
- DO NOT re-list every down machine in full detail. The complete breakdown table is already printed directly below.
- FOCUS ONLY ON:
  1. High-level fleet availability count (e.g. "X units down, Y returned to production").
  2. Critical path blockers (P1/P2 machines, hotshot parts courier ETAs, weather holds).
  3. Immediate 06:00/18:00 changeover trade actions and watch inspections.
- Keep the entire output under 150 words. Crisp, direct, operational crib-room English.

OUTPUT FORMAT:
### Executive Shift Briefing
- **Shift Status:** [1-2 sentences on safety status, weather hold status, and manning balance]
- **Critical Path Hold Points:** [Only high-priority bottlenecks, courier parts ETAs, or pit access delays]
- **Hot-Seat Directives:** [2 to 3 immediate physical actions for trades at shift changeover]`;

  const url = `${azure.endpoint}/openai/deployments/${azure.deploymentName}/chat/completions?api-version=${azure.apiVersion}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azure.apiKey,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({
              shift: shiftName,
              supervisor,
              weather: weatherNotes || '',
              safety: safetyNotes || '',
              manning: manningNotes || '',
              priorities: priorityNotes || '',
              activeMachines,
              releasedMachines,
              watchItems: watchItems || [],
            }),
          },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      console.error(`[ai-handover] upstream ${response.status}:`, await response.text());
      return NextResponse.json({ error: 'Summary generation failed' }, { status: 502 });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || 'Failed to generate summary.';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[ai-handover] request failed:', error);
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 502 });
  }
}
