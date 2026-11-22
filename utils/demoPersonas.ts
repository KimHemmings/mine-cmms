import type { AccessLevel, Department } from '@/utils/permissions';

export const DEMO_PERSONAS = [
  { id: 'production-l3', label: 'Production Sup L3', department: 'production', accessLevel: 3 },
  { id: 'workshop-l3', label: 'Workshop Sup L3', department: 'workshop', accessLevel: 3 },
  { id: 'training-l3', label: 'Training L3', department: 'training', accessLevel: 3 },
  { id: 'super-l4', label: 'Dept. Super L4', department: 'production', accessLevel: 4 },
  { id: 'sse-l5', label: 'SSE / GM L5', department: 'production', accessLevel: 5 },
] as const satisfies readonly { id: string; label: string; department: Department; accessLevel: AccessLevel }[];

export type DemoPersonaId = (typeof DEMO_PERSONAS)[number]['id'];

export function demoPersona(id: string | null | undefined) {
  return DEMO_PERSONAS.find((persona) => persona.id === id) ?? null;
}

export function demoModeRequested() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') === '1') return true;
  return window.sessionStorage.getItem('mine-cmms-demo') === '1';
}
