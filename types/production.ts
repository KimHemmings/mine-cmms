import type { TraineeLine } from './crew';
import type { OceAttachment, SafetyIncident } from './handover';

export const PRODUCTION_PLANT = [
  'Haul Truck',
  'Excavator',
  'Dozer',
  'Grader',
  'Electric Shovel',
  'Wheel Dozer',
  'Wheel Loader',
  'Water Cart',
  'Blast Drill',
] as const;

export interface OperatorPassout {
  id: string;
  crew_member_id: string;
  asset_id: string;
  expires_on: string;
}

export interface ShiftMachineOperator {
  id: string;
  shift_id: string;
  asset_id: string;
  crew_member_id: string;
}

export interface ProductionDelay {
  id: string;
  fleetId: string;
  reason: string;
}

export interface ProductionCrewLine {
  fleetId: string;
  machine: string;
  operator: string;
  location: string;
}

export interface ProductionHandoverDocument {
  summary: string | null;
  delays: ProductionDelay[];
  safetyIncidents: SafetyIncident[];
  safetyFocus: string | null;
  oce: OceAttachment | null;
  inTraining: TraineeLine[];
  ertOnSite: string[];
  assessorsOnSite: string[];
  allocations: ProductionCrewLine[];
  notCrewed: { fleetId: string; machine: string; location: string }[];
  inWorkshop: { fleetId: string; location: string; expected: string }[];
}
