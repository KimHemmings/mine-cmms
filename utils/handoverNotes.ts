import { HandoverLogCategory } from '@/types';

export interface HandoverNoteSource {
  category?: string | null;
  fleet_id?: string | null;
  details?: string | null;
  action_required?: string | null;
}

export function handoverNotesFor(entries: HandoverNoteSource[], categories: HandoverLogCategory[]) {
  const wanted = new Set<string>(categories);
  return entries
    .filter((entry) => entry.category && wanted.has(entry.category) && entry.details?.trim())
    .map((entry) => {
      const parts = [];
      if (entry.fleet_id?.trim()) parts.push(`[${entry.fleet_id.trim()}]`);
      parts.push(entry.details!.trim());
      if (entry.action_required?.trim()) parts.push(`Action: ${entry.action_required.trim()}`);
      return parts.join(' ');
    })
    .join('; ');
}
