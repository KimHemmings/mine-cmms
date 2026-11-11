// types/index.ts
export * from './constants';
export * from './parts';
export * from './crew';

import type { WorkOrderPart } from './parts';

export type UserRole = 'management' | 'fitter';

export interface UserProfile {
  id: string;
  display_name: string;
  employee_id: string | null;
  role: UserRole;
  active: boolean;
}

export interface ShiftRecord {
  id: string;
  shift_name: string;
  shift_date: string;
  supervisor: string | null;
  status: 'ACTIVE' | 'HANDED_OVER' | 'ARCHIVED';
  handover_notes: string | null;
  started_at: string;
  closed_at: string | null;
}

export type OrderType = 'PLANNED' | 'UNPLANNED' | 'INSPECTION' | 'ACCIDENT_DAMAGE';
export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'P4' | null;

export type WorkOrderStage =
  | 'IN_PROGRESS'
  | 'WAITING_LABOUR'
  | 'WAITING_PARTS'
  | 'WAITING_PRODUCTION'
  | 'WEATHER_DELAY'
  | 'COMPLETED';

export interface MachineWorkOrder {
  id: string;
  asset_id: string;
  shift_id: string;
  wo_number: string | null;          // Optional for breakdown entry
  notification_num: string | null;   // Optional[cite: 6]
  order_type: string;
  task_description: string;
  component_systems: string[];
  fitter_assigned: string | null;
  stage: WorkOrderStage;
  status: 'OPEN' | 'COMPLETED';
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  is_main_event?: boolean;
  parts?: WorkOrderPart[];           // Direct relation to parts tracker
  crew?: { crew_member_id: string }[];
}

export interface DefectItem {
  id: string;
  asset_id: string;
  shift_id?: string | null;
  severity: 'CAT1' | 'CAT2' | 'CAT3';
  description: string;
  reported_by: string;
  status: 'OPEN' | 'FIXED_THIS_SHIFT' | 'DEFERRED';
  rectified_by?: string | null;
  rectified_at?: string | null;
  created_at: string;
  wo_number?: string | null;
  notification_num?: string | null;
  order_type?: string;
  component_systems?: string[];
  fitter_assigned?: string | null;
  stage?: string;
}

export interface Asset {
  id: string;
  fleet_id: string;
  asset_type: string;
  make_model: string;
  location: string;
  machine_owner?: string | null;
  serial_number?: string | null;
  status: 'OPERATIONAL' | 'DOWN_UNPLANNED' | 'DOWN_PLANNED';
  priority: PriorityLevel;
  in_shift: boolean;
  down_since: string | null;
  expected_up: string | null;
  actual_up: string | null;
  component_system?: string | null;
  component_systems?: string[] | null;
  work_order_num?: string | null;
  sap_notification?: string | null;
  shift_task?: string | null;
  fitter_assigned?: string | null;
  shift_stage?: string;
}

// AFTER:
export interface HistoryNote {
  id: string;
  asset_id: string;
  item_id?: string | null;
  work_order_id?: string | null;
  fitter_name: string;
  note: string;
  stage: string;
  created_at: string;
}

export interface AssetWatchItem {
  id: string;
  fleet_id: string;
  date_logged: string;
  issue_description: string;
  inspection_action: string;
}

export type HandoverLogCategory =
  | 'SAFETY'
  | 'WEATHER'
  | 'MANNING'
  | 'WATCHLIST'
  | 'BRAKE_TEST'
  | 'TOOLING'
  | 'PRIORITY';

export interface HandoverLogEntry {
  id: string;
  category: HandoverLogCategory;
  fleet_id?: string;
  details: string;
  action_required?: string;
  logged_at: string;
}