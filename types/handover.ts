export interface HandoverSlide {
  id: string;
  title: string;
  notes: string;
}

export interface HandoverOrderLine {
  woNumber: string | null;
  task: string;
  stage: string;
  fitter: string | null;
  hotshots: { description: string; eta: string | null }[];
}

export interface HandoverPartLine {
  fleetId: string;
  woNumber: string | null;
  description: string;
  partNumber: string | null;
  po: string | null;
  status: string;
  eta: string | null;
  hotshot: boolean;
  carrier: string | null;
}

export interface HandoverCarryJob {
  fleetId: string;
  woNumber: string | null;
  task: string;
  stage: string;
  names: string[];
}

export interface HandoverAllocation {
  panel: string | null;
  people: { name: string; trade: string; jobs: HandoverCarryJob[] }[];
  withOutgoing: HandoverCarryJob[];
  needsName: HandoverCarryJob[];
}

export interface HandoverMachineLine {
  fleetId: string;
  makeModel: string;
  location: string;
  priority: string | null;
  expectedUp: string | null;
  orders: HandoverOrderLine[];
}

export interface HandoverDefectLine {
  severity: string;
  fleetId: string | null;
  description: string;
}

export interface HandoverMachineNote {
  fleetId: string;
  summary: string;
}

export interface HandoverSnapshot {
  summary: string | null;
  machineNotes: HandoverMachineNote[];
  log: {
    id: string;
    category: string;
    fleet_id?: string;
    details: string;
    action_required?: string;
    logged_at: string;
  }[];
  handedOver: HandoverMachineLine[];
  parts: HandoverPartLine[];
  allocation: HandoverAllocation;
  released: { fleetId: string; makeModel: string }[];
  defectsFixed: HandoverDefectLine[];
  defectsOpen: HandoverDefectLine[];
  customSlides: HandoverSlide[];
}

export interface SavedHandover {
  id: string;
  shift_id: string;
  shift_name: string;
  shift_date: string | null;
  shift_type: string | null;
  crew: string | null;
  supervisor: string | null;
  document: HandoverSnapshot;
  saved_at: string;
  saved_by: string | null;
}
