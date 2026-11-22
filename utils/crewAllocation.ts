import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import { getEventConfig, STAGE_THEMES } from '@/components/workboard/workboardTheme';
import { holdBadge } from '@/utils/jobHold';

export const SHIFT_DUTIES = ['Pit Patrol / Field', 'Workshop / Fab'] as const;
export type ShiftDuty = (typeof SHIFT_DUTIES)[number];

export const PRODUCTION_DUTIES = ['Hot Seat / Relief (General)', 'Standby / Crib Relief', 'Pit Utility / Ancillary', 'Go-Line / Training'] as const;
export type ProductionDuty = (typeof PRODUCTION_DUTIES)[number];
export type AnyDuty = ShiftDuty | ProductionDuty;

export type AllocationRole = 'Primary' | 'Hot Seat' | 'Trainee (Buddy Seat)';

export function seatLabel(role: AllocationRole | null | undefined) {
  if (role === 'Hot Seat') return 'Hot Seat';
  if (role === 'Trainee (Buddy Seat)') return 'Trainee';
  return 'Primary';
}

export function nextAllocationRole(role: AllocationRole | null | undefined): AllocationRole {
  if (role === 'Hot Seat') return 'Trainee (Buddy Seat)';
  if (role === 'Trainee (Buddy Seat)') return 'Primary';
  return 'Hot Seat';
}

export type AllocationChoice =
  | { type: 'machine'; assetId: string; role?: AllocationRole }
  | { type: 'duty'; duty: AnyDuty }
  | { type: 'role'; role: AllocationRole }
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

export function fleetLabel(assetId: string | null | undefined, assets: Asset[]) {
  if (!assetId) return '';
  return assets.find((asset) => asset.id === assetId)?.fleet_id ?? '';
}

export function equipmentModels(assets: Asset[]) {
  return [...new Set(assets.map((asset) => asset.make_model.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

export function machineMatchesTickets(asset: Asset, tickets: string[]) {
  const model = asset.make_model.trim().toLowerCase();
  const type = (asset.asset_type || '').trim().toLowerCase();
  return tickets.some((ticket) => {
    const needle = ticket.trim().toLowerCase();
    if (!needle) return false;
    return model === needle || type === needle || model.includes(needle) || type.includes(needle);
  });
}

export function machineHasPassedOutPrimary(asset: Asset, roster: CrewMember[], memberId: string) {
  return roster.some((person) =>
    person.id !== memberId
    && person.active
    && !person.away
    && person.allocated_machine_id === asset.id
    && person.allocated_role === 'Primary'
    && machineMatchesTickets(asset, person.passed_out_equipment ?? []),
  );
}

export function defaultAllocationRole(assetId: string, memberId: string, roster: CrewMember[]): AllocationRole {
  const primaryTaken = roster.some((person) =>
    person.id !== memberId
    && person.active
    && person.allocated_machine_id === assetId
    && person.allocated_role === 'Primary',
  );
  return primaryTaken ? 'Hot Seat' : 'Primary';
}

export function namesOnMachine(assetId: string, roster: CrewMember[]) {
  return roster
    .filter((person) => person.active && person.allocated_machine_id === assetId)
    .map((person) => person.display_name);
}

export function preStartUnit(
  member: Pick<CrewMember, 'id' | 'shift_duty' | 'allocated_machine_id' | 'allocated_role' | 'department'>,
  workOrders: MachineWorkOrder[],
  assets: Asset[],
) {
  const production = (member.department || '').toLowerCase() === 'production';
  const fleet = fleetLabel(member.allocated_machine_id, assets);
  if (production) {
    if (!fleet) return member.shift_duty?.trim() || '';
    return member.allocated_role ? `${fleet} (${seatLabel(member.allocated_role)})` : fleet;
  }
  const jobs = memberAssignments(member.id, workOrders, assets);
  if (jobs.length > 0) return jobs.map((job) => job.fleetId).join(', ');
  return member.shift_duty?.trim() || '';
}

export function preStartLocation(
  member: Pick<CrewMember, 'id' | 'shift_duty' | 'allocated_machine_id' | 'department'>,
  workOrders: MachineWorkOrder[],
  assets: Asset[],
  downAssetIds: string[] = [],
) {
  const production = (member.department || '').toLowerCase() === 'production';
  if (production) {
    if (!member.allocated_machine_id) return '';
    if (downAssetIds.includes(member.allocated_machine_id)) return 'Workshop (Down)';
    return assets.find((asset) => asset.id === member.allocated_machine_id)?.location?.trim() || '';
  }
  const jobs = memberAssignments(member.id, workOrders, assets);
  if (jobs.length > 0) {
    const places = jobs
      .map((job) => assets.find((asset) => asset.id === job.assetId)?.location?.trim())
      .filter((place): place is string => Boolean(place));
    return [...new Set(places)].join(', ');
  }
  if (member.shift_duty === 'Pit Patrol / Field') return 'Field / Pit';
  if (member.shift_duty === 'Workshop / Fab') return 'Workshop';
  return '';
}

export interface ProductionSeatLine {
  key: string;
  unit: string;
  location: string;
  people: string;
}

export function productionSeatLines(operators: CrewMember[], assets: Asset[], downAssetIds: string[] = []): ProductionSeatLine[] {
  const machines = new Map<string, CrewMember[]>();
  const duties = new Map<string, CrewMember[]>();
  const open: CrewMember[] = [];
  for (const member of operators) {
    if (member.allocated_machine_id) {
      const list = machines.get(member.allocated_machine_id) ?? [];
      list.push(member);
      machines.set(member.allocated_machine_id, list);
    } else if (member.shift_duty?.trim()) {
      const duty = member.shift_duty.trim();
      const list = duties.get(duty) ?? [];
      list.push(member);
      duties.set(duty, list);
    } else {
      open.push(member);
    }
  }

  const roleOrder = (member: CrewMember) => (member.allocated_role === 'Trainee (Buddy Seat)' ? 2 : member.allocated_role === 'Hot Seat' ? 1 : 0);
  const seat = (member: CrewMember) => `${member.display_name} (${seatLabel(member.allocated_role)})`;
  const lines: ProductionSeatLine[] = [...machines.entries()]
    .map(([assetId, people]) => {
      const asset = assets.find((item) => item.id === assetId);
      const ordered = [...people].sort((a, b) => roleOrder(a) - roleOrder(b) || a.display_name.localeCompare(b.display_name));
      return {
        key: assetId,
        unit: asset?.fleet_id || 'Machine',
        location: downAssetIds.includes(assetId) ? 'Workshop (Down)' : asset?.location?.trim() || '',
        people: ordered.map(seat).join(', '),
        sort: asset?.fleet_id || '',
      };
    })
    .sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }))
    .map(({ sort: _sort, ...line }) => line);

  for (const [duty, people] of [...duties.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push({
      key: `duty:${duty}`,
      unit: duty,
      location: '',
      people: people.map((person) => person.display_name).sort((a, b) => a.localeCompare(b)).join(', '),
    });
  }
  if (open.length > 0) {
    lines.push({
      key: 'unassigned',
      unit: 'Unassigned',
      location: '',
      people: open.map((person) => person.display_name).sort((a, b) => a.localeCompare(b)).join(', '),
    });
  }
  return lines;
}

export function allocatedUnitText(member: Pick<CrewMember, 'id' | 'shift_duty' | 'allocated_machine_id'>, workOrders: MachineWorkOrder[], assets: Asset[]) {
  const fleet = fleetLabel(member.allocated_machine_id, assets);
  if (fleet) return fleet;
  const jobs = memberAssignments(member.id, workOrders, assets);
  if (jobs.length > 0) return jobs.map((job) => job.fleetId).join(', ');
  return member.shift_duty?.trim() || '';
}

export function allocationSummary(member: Pick<CrewMember, 'id' | 'shift_duty' | 'allocated_machine_id'>, workOrders: MachineWorkOrder[], assets: Asset[]) {
  const fleet = fleetLabel(member.allocated_machine_id, assets);
  if (fleet) return fleet;
  const jobs = memberAssignments(member.id, workOrders, assets);
  if (jobs.length > 0) return jobs.map((job) => `${job.fleetId} • ${job.statusLabel}`).join(', ');
  return member.shift_duty?.trim() || 'Unassigned';
}
