// types/crew.ts
export const CREW_DEPARTMENTS = ['Workshop', 'Production'] as const;

export const CREW_PANELS = ['A Crew', 'B Crew', 'C Crew', 'D Crew'] as const;

export const CREW_TRADES = [
  'Fitter',
  'Auto Electrician',
  'Boilermaker',
  'Leading Hand',
  'Apprentice',
  'Operator',
  'Other',
] as const;

export interface CrewMember {
  id: string;
  display_name: string;
  employee_id: string | null;
  department: string;
  trade: string;
  panel: string | null;
  active: boolean;
  created_at: string;
}

export type SupervisionLevel = 'close' | 'minimal';

export interface CrewSupervision {
  crew_member_id: string;
  level: SupervisionLevel;
  skill: string;
  assessor_id: string | null;
}

export interface TraineeLine {
  name: string;
  level: string;
  skill: string;
  assessor: string;
  assessorOnSite: boolean;
}

export interface CrewMemberInput {
  display_name: string;
  employee_id: string | null;
  department: string;
  trade: string;
  panel: string | null;
}
