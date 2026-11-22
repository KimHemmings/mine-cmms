// types/crew.ts
export const CREW_DEPARTMENTS = [
  { value: 'workshop', label: 'Workshop' },
  { value: 'production', label: 'Production' },
  { value: 'training', label: 'Training' },
] as const;

export const ACCESS_LEVELS = [
  { value: 1, label: 'Level 1 — Read-Only' },
  { value: 2, label: 'Level 2 — Crew' },
  { value: 3, label: 'Level 3 — Supervisor' },
] as const;

export const CREW_PANELS = ['A Crew', 'B Crew', 'C Crew', 'D Crew'] as const;

export const CREW_TRADES = [
  'Fitter',
  'Auto Electrician',
  'Boilermaker',
  'Leading Hand',
  'Apprentice',
  'Operator',
  'Crew Trainer',
  'OCE',
  'Other',
] as const;

export interface CrewMember {
  id: string;
  display_name: string;
  employee_id: string | null;
  department: string;
  access_level: number;
  trade: string;
  panel: string | null;
  email: string | null;
  away: boolean;
  shift_duty: string | null;
  is_contractor: boolean;
  contractor_company: string | null;
  overtime_crew_group: string | null;
  shift_expires_at: string | null;
  active: boolean;
  created_at: string;
}

export type SupervisionLevel = 'close' | 'minimal';

export interface CrewSupervision {
  crew_member_id: string;
  level: SupervisionLevel;
  skill: string;
  assessor_id: string | null;
  starts_on?: string | null;
}

export interface TraineeLine {
  name: string;
  level: string;
  skill: string;
  assessor: string;
  assessorOnSite: boolean;
  startsLabel?: string;
}

export interface CrewMemberInput {
  display_name: string;
  employee_id: string | null;
  department: string;
  access_level: number;
  trade: string;
  panel: string | null;
  email: string | null;
}
