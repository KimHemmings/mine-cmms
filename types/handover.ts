import type { TraineeLine } from './crew';

export interface HandoverSlide {
  id: string;
  title: string;
  notes: string;
}

export interface SafetyIncident {
  id: string;
  what: string;
  where: string;
  action: string;
}

export interface OceBriefing {
  summary: string;
  hazards: string[];
  incidents: string[];
  restrictions: string[];
  conditions: string[];
}

export interface OceAttachment {
  fileName: string | null;
  briefing: OceBriefing;
  sourceText?: string | null;
  storagePath?: string | null;
  fileSize?: number | null;
  dataUrl?: string | null;
}

export interface OceReport {
  id: string;
  shift_id: string;
  file_name: string;
  storage_path: string | null;
  source_text: string | null;
  file_size?: number | null;
  briefing: OceBriefing;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface HandoverOrderLine {
  woNumber: string | null;
  task: string;
  components?: string[];
  priority?: string | null;
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
  kind?: 'on_order' | 'hotshot' | 'borrowed' | null;
  orderedOn?: string | null;
  reason?: string | null;
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

export interface HandoverManning {
  panel: string | null;
  onShift: string[];
  away: string[];
  overtime: string[];
  unallocated: string[];
  assigned: string[];
  outgoing: string | null;
  oncoming: string | null;
}

export interface HandoverMachineLine {
  machineId: string;
  fleetId: string;
  makeModel: string;
  location: string;
  priority: string;
  expectedUp: string | null;
  actualUp?: string | null;
  orders: HandoverOrderLine[];
  shiftNotes: { at: string; by: string; note: string }[];
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
  shift_summary?: string | null;
  oce_summary?: string | null;
  outgoingCrew?: string | null;
  incomingCrew?: string | null;
  machineNotes: HandoverMachineNote[];
  machine_summaries: Record<string, string[]>;
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
  manning: HandoverManning | null;
  released: HandoverMachineLine[];
  defectsFixed: HandoverDefectLine[];
  defectsOpen: HandoverDefectLine[];
  safetyIncidents: SafetyIncident[];
  safetyFocus: string | null;
  oce: OceAttachment | null;
  inTraining: TraineeLine[];
  ertOnSite: string[];
  assessorsOnSite: string[];
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
  shift_summary?: string | null;
  oce_summary?: string | null;
  saved_at: string;
  saved_by: string | null;
  outgoing_signed_by: string | null;
  outgoing_signed_at: string | null;
  oncoming_signed_by: string | null;
  oncoming_signed_at: string | null;
}
