export type TrainingItemKind = 'AUTHORISATION' | 'SOP';

export interface Authorisation {
  id: string;
  name: string;
  sort_order: number;
  kind: TrainingItemKind;
}

export interface CrewAuthorisation {
  id: string;
  crew_member_id: string;
  authorisation_id: string;
  expires_on: string;
}

export const DUE_SOON_DAYS = 30;

export type AuthorisationState = 'current' | 'due' | 'expired' | 'not_held';

export function authorisationState(expiresOn: string | null, today = new Date()): AuthorisationState {
  if (!expiresOn) return 'not_held';
  const expiry = new Date(`${expiresOn.slice(0, 10)}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueLimit = new Date(start);
  dueLimit.setDate(dueLimit.getDate() + DUE_SOON_DAYS);
  if (expiry < start) return 'expired';
  if (expiry <= dueLimit) return 'due';
  return 'current';
}

export function personLight(expiresOn: string[]): 'expired' | 'due' | null {
  const states = expiresOn.map((date) => authorisationState(date));
  if (states.includes('expired')) return 'expired';
  if (states.includes('due')) return 'due';
  return null;
}
