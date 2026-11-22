import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import { getEventConfig, STAGE_THEMES } from '@/components/workboard/workboardTheme';
import { holdBadge } from '@/utils/jobHold';

export const SHIFT_DUTIES = ['Pit Patrol / Field', 'Workshop / Fab'] as const;
export type ShiftDuty = (typeof SHIFT_DUTIES)[number];

export type AllocationChoice =
  | { type: 'machine'; assetId: string }
  | { type: 'duty'; duty: ShiftDuty }
  | { type: 'clear' };

export interface WhiteboardMachine {
  assetId: string;
  fleetId: string;
  priority: string;
  classification: string;
  workOrderId: string;
}

export interface MemberAssignment {
  assetId: string;
  fleetId: string;
  workOrderId: string;
  statusLabel: string;
}

const PRIORITY_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };

function priorityRank(priority?: string | null) {
  return PRIORITY_RANK[priority ?? ''] ?? 5;
}

function classificationLabel(order: MachineWorkOrder, asset?: Asset) {
  const label = getEventConfig(order.order_type, asset?.status === 'DOWN_PLANNED').label;
  if (label === 'BREAKDOWN') return 'Breakdown';
  if (label === 'PLANNED PM') return 'Planned PM';
  if (label === 'ACCIDENT DAMAGE') return 'Accident Damage';
  if (label === 'INSPECTION') return 'Inspection';
  return label;
}

export function jobStatusLabel(stage?: string | null, holdEta?: string | null) {
  return holdBadge(stage, holdEta) ?? (stage ? STAGE_THEMES[stage]?.label : null) ?? 'Open';
}

export function mainOpenJob(orders: MachineWorkOrder[]) {
  const open = orders.filter((order) => order.status !== 'COMPLETED');
  if (open.length === 0) return undefined;
  const flagged = open.filter((order) => order.is_main_event);
  const chosen = flagged.length > 0 ? flagged : open;
  return [...chosen].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
}

export function whiteboardMachines(assets: Asset[], workOrders: MachineWorkOrder[]): WhiteboardMachine[] {
  const open = workOrders.filter((order) => order.status !== 'COMPLETED');
  return assets
    .flatMap((asset) => {
      const main = mainOpenJob(open.filter((order) => order.asset_id === asset.id));
      if (!main) return [];
      return [{
        assetId: asset.id,
        fleetId: asset.fleet_id,
        priority: asset.priority || '—',
        classification: classificationLabel(main, asset),
        workOrderId: main.id,
      }];
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.fleetId.localeCompare(b.fleetId, undefined, { numeric: true }));
}

export function memberAssignments(memberId: string, workOrders: MachineWorkOrder[], assets: Asset[]): MemberAssignment[] {
  const open = workOrders.filter(
    (order) => order.status !== 'COMPLETED' && order.crew?.some((row) => row.crew_member_id === memberId),
  );
  const byAsset = new Map<string, MachineWorkOrder[]>();
  for (const order of open) {
    const list = byAsset.get(order.asset_id) ?? [];
    list.push(order);
    byAsset.set(order.asset_id, list);
  }

  return [...byAsset.entries()]
    .flatMap(([assetId, orders]) => {
      const main = mainOpenJob(orders);
      if (!main) return [];
      const asset = assets.find((item) => item.id === assetId);
      return [{
        assetId,
        fleetId: asset?.fleet_id ?? 'Machine',
        workOrderId: main.id,
        statusLabel: jobStatusLabel(main.stage, main.hold_eta),
        priority: asset?.priority,
      }];
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.fleetId.localeCompare(b.fleetId, undefined, { numeric: true }))
    .map(({ priority: _priority, ...assignment }) => assignment);
}

export function dutyPill(duty: string) {
  return duty === 'Pit Patrol / Field' ? 'Pit Patrol' : duty;
}

export function allocatedUnitText(member: Pick<CrewMember, 'id' | 'shift_duty'>, workOrders: MachineWorkOrder[], assets: Asset[]) {
  const jobs = memberAssignments(member.id, workOrders, assets);
  if (jobs.length > 0) return jobs.map((job) => job.fleetId).join(', ');
  return member.shift_duty?.trim() || '';
}

export function allocationSummary(member: Pick<CrewMember, 'id' | 'shift_duty'>, workOrders: MachineWorkOrder[], assets: Asset[]) {
  const jobs = memberAssignments(member.id, workOrders, assets);
  if (jobs.length > 0) return jobs.map((job) => `${job.fleetId} • ${job.statusLabel}`).join(', ');
  return member.shift_duty?.trim() || 'Unassigned';
}
