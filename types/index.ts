export interface Asset {
  id: string;
  fleet_id: string;
  asset_type: string;
  make_model: string;
  location: string;
  status: 'OPERATIONAL' | 'DOWN_UNPLANNED' | 'DOWN_PLANNED';
  priority: 'P1' | 'P2' | 'P3' | 'P4' | null;
  component_system: string | null;
  in_shift: boolean;
  shift_task: string | null;
  fitter_assigned: string | null;
  shift_stage: string;
  down_since: string | null;
  expected_up: string | null;
  actual_up: string | null;
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
  'Suspension / Chassis', 'GET / Bucket / Blade', 'Scheduled PM Service', 'General / Unknown'
];

export const STAGES = ['DIAGNOSING', 'WAITING_PARTS', 'IN_REPAIR', 'TESTING', 'WAITING_RIGGING'];