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

export interface ShiftSeatChange {
  id: string;
  shift_id: string;
  asset_id: string;
  off_crew_member_id: string;
  on_crew_member_id: string;
  changed_at: string;
}

export interface SeatChangeLine {
  id: string;
  assetId: string;
  fleetId: string;
  text: string;
  cab: string;
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
  seatChanges: SeatChangeLine[];
  notCrewed: { fleetId: string; machine: string; location: string }[];
  inWorkshop: { fleetId: string; location: string; expected: string }[];
}
