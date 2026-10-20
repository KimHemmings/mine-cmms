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
}

export interface Asset {
  id: string;
  fleet_id: string;
  asset_type: string;
  make_model: string;
  location: string;
  machine_owner?: string | null; // Added here
  status: 'OPERATIONAL' | 'DOWN_UNPLANNED' | 'DOWN_PLANNED';
  priority: 'P1' | 'P2' | 'P3' | 'P4' | null;
  in_shift: boolean;
  down_since: string | null;
  expected_up: string | null;
  actual_up: string | null;
  
  // Legacy / fallback fields
  component_system?: string | null;
  component_systems?: string[] | null;
  work_order_num?: string | null;
  sap_notification?: string | null;
  shift_task?: string | null;
  fitter_assigned?: string | null;
  shift_stage?: string;
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
  'Engine', 'Transmission / Driveline', 'Hydraulics', 'HV Electrical', 
  'Auto Electrical', 'Air Conditioning / Cab', 'Undercarriage / Track', 
  'Suspension / Chassis', 'GET / Bucket / Blade', 'Braking & Steering', 
  'Scheduled PM Service', 'Structural / Fabrication'
];

export const STAGES = ['DIAGNOSING', 'WAITING_PARTS', 'IN_REPAIR', 'TESTING', 'WAITING_RIGGING'];