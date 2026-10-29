import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
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
    } = await req.json();

    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

    if (!apiKey || !endpoint) {
      return NextResponse.json({ error: 'Endpoint not configured' }, { status: 500 });
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

    const cleanEndpoint = endpoint.replace(/\/$/, '');
    const url = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
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
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Summary generation error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || 'Failed to generate summary.';

    return NextResponse.json({ summary });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}