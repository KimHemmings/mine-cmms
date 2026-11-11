'use client';

import { createContext, useContext } from 'react';
import { Authorisation, CrewAuthorisation, CrewMember } from '@/types';
import type { CrewJob } from '@/utils/crew';

export interface CrewData {
  crew: CrewMember[];
  onShiftIds: Set<string>;
  openJobsByCrew: Map<string, CrewJob[]>;
  openJobCounts: Map<string, number>;
  authorisations: Authorisation[];
  holdings: CrewAuthorisation[];
  canCheckAuthorisations: boolean;
}

export const CrewDataContext = createContext<CrewData>({
  crew: [],
  onShiftIds: new Set(),
  openJobsByCrew: new Map(),
  openJobCounts: new Map(),
  authorisations: [],
  holdings: [],
  canCheckAuthorisations: false,
});

export const useCrewData = () => useContext(CrewDataContext);

export function crewNames(crew: CrewMember[], ids: string[]) {
  return crew
    .filter((c) => ids.includes(c.id))
    .map((c) => c.display_name)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
}
