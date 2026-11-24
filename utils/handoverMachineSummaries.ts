export interface HandoverAiMachineContext {
  machine_id: string;
  fleet_id: string;
  model: string;
  priority: string;
  expected_up: string | null;
  status: 'DOWN' | 'RELEASED';
  jobs: {
    wo_number: string | null;
    title: string;
    components: string[];
    priority?: string | null;
    stage: string;
    assigned_crew: string[];
  }[];
  parts: {
    description: string;
    part_number: string | null;
    status: string;
    eta: string | null;
    hotshot: boolean;
    carrier: string | null;
  }[];
  shift_notes: { at: string; by: string; note: string }[];
  updates: { at: string; category: string; details: string; action_required: string | null }[];
}

function cleanBullet(value: string) {
  return value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capWords(value: string, remaining: number) {
  return cleanBullet(value).split(/\s+/).slice(0, remaining).join(' ');
}

function rawNotesFor(machine: HandoverAiMachineContext) {
  return [
    ...machine.shift_notes.map((entry) => ({ at: entry.at, note: entry.note })),
    ...machine.updates.map((entry) => ({
      at: entry.at,
      note: [entry.details, entry.action_required].filter(Boolean).join(' — '),
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((entry) => entry.note);
}

export function fallbackMachineSummaries(machines: HandoverAiMachineContext[]) {
  return Object.fromEntries(
    machines.map((machine) => {
      const seen = new Set<string>();
      const uniqueNotes = rawNotesFor(machine).map(cleanBullet).filter((note) => {
        const key = note.toLowerCase().replace(/[^\w]+/g, ' ').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const bullets = uniqueNotes.length > 0
        ? uniqueNotes.slice(-2)
        : ['No shift notes recorded; verify fault status and release checks.'];
      return [machine.machine_id, limitMachineBullets(bullets)];
    }),
  );
}

export function limitMachineBullets(bullets: string[]) {
  let remaining = 25;
  return bullets
    .slice(0, 2)
    .map((bullet) => {
      const result = capWords(bullet, remaining);
      remaining -= result ? result.split(/\s+/).length : 0;
      return result;
    })
    .filter(Boolean);
}

export function normalizeMachineSummaries(value: unknown, machines: HandoverAiMachineContext[]) {
  const supplied = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fallback = fallbackMachineSummaries(machines);

  return Object.fromEntries(
    machines.map((machine) => {
      const rawBullets = supplied[machine.machine_id];
      const candidates = Array.isArray(rawBullets)
        ? rawBullets.filter((bullet): bullet is string => typeof bullet === 'string').slice(0, 2)
        : [];
      const bullets = limitMachineBullets(candidates);
      return [machine.machine_id, bullets.length > 0 ? bullets : fallback[machine.machine_id]];
    }),
  );
}
