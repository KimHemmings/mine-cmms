// types/parts.ts
export type PartStatus = 'ORDERED' | 'IN_TRANSIT' | 'RECEIVED';

export interface WorkOrderPart {
  id: string;
  work_order_id: string;
  part_number?: string | null;
  description: string;
  po_or_reservation?: string | null;
  is_special_run: boolean;
  carrier_details?: string | null;
  eta?: string | null;
  status: PartStatus;
  created_at: string;
  updated_at: string;
}

export type PartsBoardKind = 'on_order' | 'hotshot' | 'borrowed';

export interface PartsBoardRow {
  id: string;
  asset_id: string | null;
  fleet_id: string;
  kind: PartsBoardKind;
  supplier: string | null;
  ordered_on: string | null;
  eta: string | null;
  description: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreatePartPayload {
  workOrderId: string;
  partNumber?: string;
  description: string;
  poOrReservation?: string;
  isSpecialRun: boolean;
  carrierDetails?: string;
  eta?: string;
}