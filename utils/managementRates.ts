import { Asset, CrewMember } from '@/types';
import { normalizeDepartment } from '@/utils/permissions';
import { getShiftClock } from '@/utils/shiftClock';
import { CrewLetter, panelForLetter, visibleOnCrewTab } from '@/utils/shiftRoster';

export interface SiteTargets {
  show_financials: boolean;
  target_rom_tonnes_shift: number;
  target_prime_bcm_shift: number;
  target_primary_pa_pct: number;
  target_primary_uoa_pct: number;
  coal_margin_per_tonne: number;
  primary_digger_hr_cost: number;
  primary_truck_hr_cost: number;
  overtime_shift_cost: number;
  contractor_shift_cost: number;
  chpp_wash_yield_pct: number;
  overburden_rate_per_bcm: number;
  operator_contractor_shift_cost: number;
  trades_contractor_shift_cost: number;
}

export const BOWEN_TARGETS: SiteTargets = {
  show_financials: true,
  target_rom_tonnes_shift: 15000,
  target_prime_bcm_shift: 45000,
  target_primary_pa_pct: 86,
  target_primary_uoa_pct: 82,
  coal_margin_per_tonne: 115,
  primary_digger_hr_cost: 18500,
  primary_truck_hr_cost: 4200,
  overtime_shift_cost: 950,
  contractor_shift_cost: 1450,
  chpp_wash_yield_pct: 75,
  overburden_rate_per_bcm: 5.5,
  operator_contractor_shift_cost: 1380,
  trades_contractor_shift_cost: 1680,
};

const NUMERIC_KEYS = [
  'target_rom_tonnes_shift',
  'target_prime_bcm_shift',
  'target_primary_pa_pct',
  'target_primary_uoa_pct',
  'coal_margin_per_tonne',
  'primary_digger_hr_cost',
  'primary_truck_hr_cost',
  'overtime_shift_cost',
  'contractor_shift_cost',
  'chpp_wash_yield_pct',
  'overburden_rate_per_bcm',
  'operator_contractor_shift_cost',
  'trades_contractor_shift_cost',
] as const satisfies readonly (keyof SiteTargets)[];

export const TARGET_FIELDS: { key: (typeof NUMERIC_KEYS)[number]; label: string; suffix: string; max?: number }[] = [
  { key: 'target_primary_pa_pct', label: 'Primary physical availability target', suffix: '%', max: 100 },
  { key: 'target_primary_uoa_pct', label: 'Primary use of availability target', suffix: '%', max: 100 },
  { key: 'target_rom_tonnes_shift', label: 'ROM coal target', suffix: 't / shift' },
  { key: 'target_prime_bcm_shift', label: 'Prime BCM target', suffix: 'BCM / shift' },
  { key: 'chpp_wash_yield_pct', label: 'CHPP wash yield', suffix: '%', max: 100 },
  { key: 'coal_margin_per_tonne', label: 'Coal margin on saleable tonnes', suffix: '$ / t' },
  { key: 'overburden_rate_per_bcm', label: 'Overburden rate', suffix: '$ / BCM' },
  { key: 'primary_digger_hr_cost', label: 'Primary digger hourly cost', suffix: '$ / h' },
  { key: 'primary_truck_hr_cost', label: 'Primary truck hourly cost', suffix: '$ / h' },
  { key: 'overtime_shift_cost', label: 'Overtime cost', suffix: '$ / person / shift' },
  { key: 'operator_contractor_shift_cost', label: 'Production contractor', suffix: '$ / person / shift' },
  { key: 'trades_contractor_shift_cost', label: 'Workshop contractor', suffix: '$ / person / shift' },
];

export function targetsFromRow(row: Record<string, unknown> | null): SiteTargets {
  const next = { ...BOWEN_TARGETS };
  if (!row) return next;
  if (typeof row.show_financials === 'boolean') next.show_financials = row.show_financials;
  for (const key of NUMERIC_KEYS) {
    const raw = row[key];
    if (raw == null || raw === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) next[key] = value;
  }
  return next;
}

export function formatAudExact(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString('en-AU')}`;
}

/** Hours still left on the live shift. A finished shift is priced as one 12h shift. */
export function exposureHorizon(now = new Date()) {
  const clock = getShiftClock(now);
  const raw = (clock.shiftEnd.getTime() - now.getTime()) / 3_600_000;
  if (raw >= 0.1) {
    const hours = Math.round(raw * 10) / 10;
    const shown = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
    return { hours, label: `${shown}h remaining this shift` };
  }
  return { hours: 12, label: '12h shift equivalent' };
}

export function formatAud(value: number) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = Math.round((abs / 1_000_000) * 10) / 10;
    return `${sign}$${millions.toLocaleString('en-AU', { maximumFractionDigits: 1 })}m`;
  }
  if (abs >= 10_000) {
    const thousands = Math.round((abs / 1000) * 10) / 10;
    const body = thousands.toLocaleString('en-AU', { maximumFractionDigits: 1 });
    return `${sign}$${body}k`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-AU')}`;
}

export function parseQuantity(value: string) {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

export type PrimaryClass = 'digger' | 'truck';

export function primaryClass(asset: { asset_type?: string | null; make_model?: string | null }): PrimaryClass | null {
  const haystack = `${asset.asset_type ?? ''} ${asset.make_model ?? ''}`.toLowerCase();
  if (/(haul|truck|793|797)/.test(haystack)) return 'truck';
  if (/(excavator|shovel|digger|\bex\s?\d)/.test(haystack)) return 'digger';
  return null;
}

export function primaryFleetCount(assets: Asset[], crew: CrewMember[], letter: CrewLetter, downAssetIds: string[]) {
  const downIds = new Set(downAssetIds);
  const manned = new Set(
    crew
      .filter((member) => member.active && !member.away && normalizeDepartment(member.department) === 'production' && visibleOnCrewTab(member, panelForLetter(letter)))
      .map((member) => member.allocated_machine_id)
      .filter((id): id is string => Boolean(id)),
  );
  const counts = { downDiggers: 0, downTrucks: 0, healthyDiggers: 0, healthyTrucks: 0, unmannedDiggers: 0, unmannedTrucks: 0 };
  for (const asset of assets) {
    const kind = primaryClass(asset);
    if (!kind) continue;
    const down = asset.status !== 'OPERATIONAL' || downIds.has(asset.id);
    if (down) {
      if (kind === 'digger') counts.downDiggers += 1;
      else counts.downTrucks += 1;
      continue;
    }
    if (kind === 'digger') counts.healthyDiggers += 1;
    else counts.healthyTrucks += 1;
    if (!manned.has(asset.id)) {
      if (kind === 'digger') counts.unmannedDiggers += 1;
      else counts.unmannedTrucks += 1;
    }
  }
  return counts;
}

export function mechanicalLoss(counts: ReturnType<typeof primaryFleetCount>, targets: SiteTargets, hours: number) {
  return (counts.downDiggers * targets.primary_digger_hr_cost + counts.downTrucks * targets.primary_truck_hr_cost) * hours;
}

export function manningLoss(counts: ReturnType<typeof primaryFleetCount>, targets: SiteTargets, hours: number) {
  return (counts.unmannedDiggers * targets.primary_digger_hr_cost + counts.unmannedTrucks * targets.primary_truck_hr_cost) * hours;
}

export function lostMachineHours(counts: ReturnType<typeof primaryFleetCount>, hours: number) {
  return (counts.downDiggers + counts.downTrucks) * hours;
}

export function unmannedHours(counts: ReturnType<typeof primaryFleetCount>, hours: number) {
  return (counts.unmannedDiggers + counts.unmannedTrucks) * hours;
}

export function useOfAvailability(counts: ReturnType<typeof primaryFleetCount>) {
  const healthy = counts.healthyDiggers + counts.healthyTrucks;
  const unmanned = counts.unmannedDiggers + counts.unmannedTrucks;
  if (healthy === 0) return 0;
  return Math.round(((healthy - unmanned) / healthy) * 100);
}

export function contractorRate(department: 'workshop' | 'production', targets: SiteTargets) {
  return department === 'workshop' ? targets.trades_contractor_shift_cost : targets.operator_contractor_shift_cost;
}

/** Hard cash only. Fleet-hour rates are not added here. */
export function shiftLabour(department: 'workshop' | 'production', overtime: number, contractors: number, targets: SiteTargets) {
  return overtime * targets.overtime_shift_cost + contractors * contractorRate(department, targets);
}

export function labourFormula(department: 'workshop' | 'production', overtime: number, contractors: number, targets: SiteTargets) {
  const rate = contractorRate(department, targets);
  const who = department === 'workshop' ? 'Trades Contractors' : 'Operator Contractors';
  const total = overtime * targets.overtime_shift_cost + contractors * rate;
  return `${overtime} OT × ${formatAudExact(targets.overtime_shift_cost)} + ${contractors} ${who} × ${formatAudExact(rate)} = ${formatAudExact(total)}`;
}

export function outputVarianceFormula(
  coal: { tonneVariance: number; bcmVariance: number; marginVariance: number; bcmDollars: number; outputVariance: number },
  targets: SiteTargets,
) {
  const tonnes = Math.round(coal.tonneVariance).toLocaleString('en-AU');
  const bcm = Math.round(coal.bcmVariance).toLocaleString('en-AU');
  return `ROM variance ${tonnes} t × ${targets.chpp_wash_yield_pct}% × ${formatAudExact(targets.coal_margin_per_tonne)} = ${formatAudExact(coal.marginVariance)}. BCM variance ${bcm} × ${formatAudExact(targets.overburden_rate_per_bcm)} = ${formatAudExact(coal.bcmDollars)}. Output variance ${formatAudExact(coal.outputVariance)}. Forward shift exposure is not added.`;
}

export function forwardExposureFormula(
  counts: ReturnType<typeof primaryFleetCount>,
  targets: SiteTargets,
  hours: number,
  label: string,
) {
  const down = mechanicalLoss(counts, targets, hours);
  const open = manningLoss(counts, targets, hours);
  return `Primary dig and haul only, ${label}. Down: ${counts.downDiggers} × ${formatAudExact(targets.primary_digger_hr_cost)} × ${hours} + ${counts.downTrucks} × ${formatAudExact(targets.primary_truck_hr_cost)} × ${hours} = ${formatAudExact(down)}. Unmanned ready: ${counts.unmannedDiggers} × ${formatAudExact(targets.primary_digger_hr_cost)} × ${hours} + ${counts.unmannedTrucks} × ${formatAudExact(targets.primary_truck_hr_cost)} × ${hours} = ${formatAudExact(open)}. Forward shift exposure ${formatAudExact(down + open)}. Not added to ROM or BCM variance.`;
}

export function unmannedByModel(assets: Asset[], crew: CrewMember[], letter: CrewLetter, downAssetIds: string[]) {
  const downIds = new Set(downAssetIds);
  const manned = new Set(
    crew
      .filter((member) => member.active && !member.away && normalizeDepartment(member.department) === 'production' && visibleOnCrewTab(member, panelForLetter(letter)))
      .map((member) => member.allocated_machine_id)
      .filter((id): id is string => Boolean(id)),
  );
  const counts = new Map<string, number>();
  for (const asset of assets) {
    if (!primaryClass(asset)) continue;
    if (asset.status !== 'OPERATIONAL' || downIds.has(asset.id)) continue;
    if (manned.has(asset.id)) continue;
    const model = asset.make_model?.trim() || 'Unknown model';
    counts.set(model, (counts.get(model) ?? 0) + 1);
  }
  return counts;
}

/** Prices only the unmanned units of this model. Those units are already inside forward shift exposure. */
export function modelForwardExposure(model: string, unmannedUnits: number, targets: SiteTargets, hours: number) {
  if (unmannedUnits <= 0) return 0;
  const kind = primaryClass({ make_model: model });
  if (!kind) return 0;
  const rate = kind === 'digger' ? targets.primary_digger_hr_cost : targets.primary_truck_hr_cost;
  return unmannedUnits * rate * hours;
}

export function coalMargin(rows: { rom: string; bcm: string }[], targets: SiteTargets) {
  const shifts = rows.length;
  let rom = 0;
  let bcm = 0;
  for (const row of rows) {
    rom += parseQuantity(row.rom) ?? 0;
    bcm += parseQuantity(row.bcm) ?? 0;
  }
  const romTarget = shifts * targets.target_rom_tonnes_shift;
  const bcmTarget = shifts * targets.target_prime_bcm_shift;
  const tonneVariance = rom - romTarget;
  const yieldRatio = targets.chpp_wash_yield_pct / 100;
  const saleable = rom * yieldRatio;
  const saleableTarget = romTarget * yieldRatio;
  const saleableVariance = tonneVariance * yieldRatio;
  const bcmVariance = bcm - bcmTarget;
  const marginVariance = tonneVariance * yieldRatio * targets.coal_margin_per_tonne;
  const bcmDollars = bcmVariance * targets.overburden_rate_per_bcm;
  return {
    shifts,
    rom,
    bcm,
    romTarget,
    bcmTarget,
    tonneVariance,
    bcmVariance,
    saleable,
    saleableTarget,
    saleableVariance,
    marginVariance,
    bcmDollars,
    outputVariance: marginVariance + bcmDollars,
  };
}
