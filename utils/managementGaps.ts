import { Asset, CrewMember, MachineWorkOrder } from '@/types';
import { isOperatorEquipment, machineMatchesTickets, mainOpenJob, memberAssignments } from '@/utils/crewAllocation';
import { getEtuStatus } from '@/utils/helpers';
import { Department, normalizeDepartment } from '@/utils/permissions';
import { HandoverRecord } from '@/utils/productionHandoverRecord';
import { CrewLetter, coveringLetter, panelForLetter, visibleOnCrewTab } from '@/utils/shiftRoster';

export const CREW_LETTERS: CrewLetter[] = ['A', 'B', 'C', 'D'];

export interface ManningRow {
  letter: CrewLetter;
  department: Department;
  permanent: number;
  away: number;
  overtime: number;
  contractors: number;
  reliancePct: number;
  unallocated: number;
}

export interface ModelGap {
  model: string;
  total: number;
  healthy: number;
  ticketed: Record<CrewLetter, number>;
  inTraining: number;
  risk: 'SHORTFALL' | 'NO CRIB RELIEF' | 'COVERED';
}

export interface ManagementSnapshot {
  ready: number;
  total: number;
  down: number;
  availabilityPct: number;
  healthy: number;
  ticketedOperators: number;
  unmanned: number;
  productionReliancePct: number;
  workshopReliancePct: number;
  shortModels: number;
  noCribModels: number;
  zeroTickets: number;
  overdueEtus: number;
  priority: Record<'P1' | 'P2' | 'P3' | 'P4' | 'None', number>;
  holds: { parts: number; oem: number; bay: number };
  manning: ManningRow[];
  models: ModelGap[];
}

function onPanel(member: CrewMember, letter: CrewLetter) {
  return member.active && visibleOnCrewTab(member, panelForLetter(letter));
}

function departmentPeople(crew: CrewMember[], letter: CrewLetter, department: Department) {
  return crew.filter((member) => normalizeDepartment(member.department) === department && onPanel(member, letter));
}

function isAllocated(member: CrewMember, workOrders: MachineWorkOrder[], assets: Asset[]) {
  if (member.allocated_role === 'Crib Floater') return true;
  if (member.allocated_machine_id || member.shift_duty?.trim()) return true;
  if (normalizeDepartment(member.department) === 'production') return false;
  return memberAssignments(member.id, workOrders, assets).length > 0;
}

function manningRow(crew: CrewMember[], letter: CrewLetter, department: Department, workOrders: MachineWorkOrder[], assets: Asset[]): ManningRow {
  const people = departmentPeople(crew, letter, department);
  const overtime = people.filter((member) => coveringLetter(member) === letter).length;
  const contractors = people.filter((member) => member.is_contractor).length;
  const away = people.filter((member) => member.away && !member.is_contractor && coveringLetter(member) !== letter).length;
  const permanent = people.filter((member) => !member.is_contractor && !member.away && coveringLetter(member) !== letter).length;
  const onTools = people.filter((member) => !member.away);
  const relianceBase = permanent + overtime + contractors;
  const unallocated = onTools.filter((member) => !isAllocated(member, workOrders, assets)).length;
  return {
    letter,
    department,
    permanent,
    away,
    overtime,
    contractors,
    reliancePct: relianceBase === 0 ? 0 : Math.round(((overtime + contractors) / relianceBase) * 100),
    unallocated,
  };
}

function gapRisk(ticketed: number, healthy: number): ModelGap['risk'] {
  if (healthy === 0 || ticketed > healthy) return 'COVERED';
  if (ticketed === healthy) return 'NO CRIB RELIEF';
  return 'SHORTFALL';
}

export function buildManagementSnapshot(
  assets: Asset[],
  crew: CrewMember[],
  workOrders: MachineWorkOrder[],
  letter: CrewLetter,
  downAssetIds: string[] = [],
  now = Date.now(),
): ManagementSnapshot {
  const downIds = new Set(downAssetIds);
  const fleet = assets.filter(isOperatorEquipment);
  const healthyAsset = (asset: Asset) => asset.status === 'OPERATIONAL' && !downIds.has(asset.id);
  const readyAssets = fleet.filter(healthyAsset);
  const total = fleet.length;
  const ready = readyAssets.length;

  const shiftOperators = crew.filter((member) =>
    normalizeDepartment(member.department) === 'production'
    && onPanel(member, letter)
    && !member.away,
  );
  const ticketedOperators = shiftOperators.filter((member) => (member.passed_out_equipment ?? []).length > 0);
  const manned = new Set(shiftOperators.map((member) => member.allocated_machine_id).filter((id): id is string => Boolean(id)));
  const productionRow = manningRow(crew, letter, 'production', workOrders, assets);
  const workshopRow = manningRow(crew, letter, 'workshop', workOrders, assets);

  const byModel = new Map<string, Asset[]>();
  for (const asset of fleet) {
    const model = asset.make_model?.trim() || 'Unknown model';
    const list = byModel.get(model) ?? [];
    list.push(asset);
    byModel.set(model, list);
  }

  const trainingPool = crew.filter((member) => member.active && !member.away && normalizeDepartment(member.department) === 'production');
  const models: ModelGap[] = [...byModel.entries()]
    .map(([model, units]) => {
      const sample = units[0];
      const ticketed = Object.fromEntries(CREW_LETTERS.map((crewLetter) => {
        const count = crew.filter((member) =>
          normalizeDepartment(member.department) === 'production'
          && onPanel(member, crewLetter)
          && !member.away
          && machineMatchesTickets(sample, member.passed_out_equipment ?? []),
        ).length;
        return [crewLetter, count];
      })) as Record<CrewLetter, number>;
      const healthy = units.filter(healthyAsset).length;
      return {
        model,
        total: units.length,
        healthy,
        ticketed,
        inTraining: trainingPool.filter((member) => machineMatchesTickets(sample, member.in_training_equipment ?? [])).length,
        risk: gapRisk(ticketed[letter], healthy),
      };
    })
    .sort((a, b) => a.model.localeCompare(b.model));

  const downAssets = assets.filter((asset) => asset.status !== 'OPERATIONAL' || downIds.has(asset.id));
  const priority = { P1: 0, P2: 0, P3: 0, P4: 0, None: 0 };
  for (const asset of downAssets) {
    if (asset.priority === 'P1' || asset.priority === 'P2' || asset.priority === 'P3' || asset.priority === 'P4') priority[asset.priority] += 1;
    else priority.None += 1;
  }
  const holds = { parts: 0, oem: 0, bay: 0 };
  const openOrders = workOrders.filter((order) => order.status !== 'COMPLETED');
  for (const asset of downAssets) {
    const job = mainOpenJob(openOrders.filter((order) => order.asset_id === asset.id));
    if (job?.stage === 'WAITING_PARTS') holds.parts += 1;
    if (job?.stage === 'WAITING_OEM') holds.oem += 1;
    if (job?.stage === 'WAITING_BAY') holds.bay += 1;
  }

  return {
    ready,
    total,
    down: total - ready,
    availabilityPct: total === 0 ? 0 : Math.round((ready / total) * 100),
    healthy: ready,
    ticketedOperators: ticketedOperators.length,
    unmanned: readyAssets.filter((asset) => !manned.has(asset.id)).length,
    productionReliancePct: productionRow.reliancePct,
    workshopReliancePct: workshopRow.reliancePct,
    shortModels: models.filter((model) => model.risk === 'SHORTFALL').length,
    noCribModels: models.filter((model) => model.risk === 'NO CRIB RELIEF').length,
    zeroTickets: shiftOperators.filter((member) => (member.passed_out_equipment ?? []).length === 0).length,
    overdueEtus: downAssets.filter((asset) => getEtuStatus(asset.expected_up, now)?.overdue).length,
    priority,
    holds,
    manning: CREW_LETTERS.flatMap((crewLetter) => (['production', 'workshop'] as Department[]).map((department) => manningRow(crew, crewLetter, department, workOrders, assets))),
    models,
  };
}

export function statutoryRollup(record: HandoverRecord | null) {
  if (!record) {
    return { oce: 'No statutory record yet', tarps: [] as string[], openIncidents: 0, hpi: 0, rom: '—', bcm: '—' };
  }
  const tarps = record.active_tarps.filter((tarp) => tarp.level !== 'Normal').map((tarp) => `${tarp.name} ${tarp.level}`);
  const open = record.incidents.filter((item) => item.openInvestigation);
  return {
    oce: record.oce_inspection_status || 'Pending Upload',
    tarps,
    openIncidents: open.length,
    hpi: open.filter((item) => item.category.includes('HPI')).length,
    rom: record.shift_production.romCoal.trim() || '—',
    bcm: record.shift_production.primeOverburden.trim() || '—',
  };
}
