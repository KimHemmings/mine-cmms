import { OceBriefing } from '@/types';

export const EMPTY_OCE_BRIEFING: OceBriefing = {
  summary: '',
  hazards: [],
  incidents: [],
  restrictions: [],
  conditions: [],
};

function points(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 240))
    .slice(0, 8);
}

export function normalizeOceBriefing(value: unknown): OceBriefing {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    summary: typeof row.summary === 'string' ? row.summary.trim().slice(0, 2000) : '',
    hazards: points(row.hazards),
    incidents: points(row.incidents),
    restrictions: points(row.restrictions),
    conditions: points(row.conditions),
  };
}
