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
  wo_number: string | null;
  notification_num: string | null;
  order_type: string;
  task_description: string;
  component_systems: string[];
  fitter_assigned: string | null;
  stage: string;
  status: 'OPEN' | 'COMPLETED';
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  is_main_event?: boolean;
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

export interface HistoryNote {
  id: string;
  asset_id: string;
  fitter_name: string;
  note: string;
  stage: string;
  created_at: string;
}

export const COMPONENT_SYSTEMS = [
  'Engine',
  'Transmission / Driveline',
  'Hydraulics',
  'HV Electrical',
  'Auto Electrical',
  'Air Conditioning / Cab',
  'Undercarriage / Track',
  'Suspension / Chassis',
  'GET / Bucket / Blade',
  'Braking & Steering',
  'Scheduled PM Service',
  'Structural / Fabrication',
];

export const ORDER_TYPES = [
  { value: 'PLANNED', label: 'Planned Maintenance' },
  { value: 'UNPLANNED', label: 'Unplanned Breakdown' },
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'ACCIDENT_DAMAGE', label: 'Accident Damage' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: 'P1', label: 'P1 - Critical' },
  { value: 'P2', label: 'P2 - High' },
  { value: 'P3', label: 'P3 - Medium' },
  { value: 'P4', label: 'P4 - Low' },
  { value: null, label: 'No Priority' },
] as const;

export const STAGES = [
  'IN_PROGRESS',
  'WAITING_LABOUR',
  'WAITING_PARTS',
  'WAITING_PRODUCTION',
  'WEATHER_DELAY',
  'COMPLETED',
] as const;

export const STAGE_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_LABOUR', label: 'Waiting on Labour' },
  { value: 'WAITING_PARTS', label: 'Wait on Parts' },
  { value: 'WAITING_PRODUCTION', label: 'Wait on Production' },
  { value: 'WEATHER_DELAY', label: 'Weather Delay' },
  { value: 'COMPLETED', label: 'Complete' },
] as const;