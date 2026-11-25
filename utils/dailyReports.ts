const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const MACHINE_CLASSES = ['Haul Trucks', 'Excavators', 'Dozers', 'Graders', 'Drills'] as const;

export type DatePreset = '24h' | '7d' | '14d' | '30d' | 'mtd' | 'custom';

export interface ReportOrder {
  id: string;
  assetId: string;
  woNumber: string | null;
  orderType: string;
  task: string;
  systems: string[];
  fitter: string | null;
  stage: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  takesMachineDown: boolean;
}

export interface ReportAsset {
  id: string;
  fleetId: string;
  assetType: string;
  makeModel: string;
  location: string;
  circuit: string | null;
  status: string;
}

export interface ReportFilter {
  assetQuery: string;
  area: string;
  machineClass: string;
  preset: DatePreset;
  start: string;
  end: string;
  lookbackDays: number;
}

export interface ParetoRow {
  name: string;
  count: number;
  hours: number;
  cumulative: number;
  orderIds: string[];
}

export interface TrendPoint {
  label: string;
  unplanned: number;
  planned: number;
  delay: number;
}

export interface StoppageRow {
  id: string;
  fleetId: string;
  machineClass: string;
  fault: string;
  hours: number;
  status: 'Down' | 'Derated' | 'Operational';
  nextAction: string;
}

export interface RepeatRow {
  fleetId: string;
  machineClass: string;
  system: string;
  countInRange: number;
  countInLookback: number;
  hoursSincePrior: number | null;
  lastRepair: string;
  crew: string;
}

export interface CrossTrend {
  machineClass: string;
  system: string;
  assets: string[];
  count: number;
}

export interface DrillOrder {
  id: string;
  fleetId: string;
  woNumber: string | null;
  task: string;
  systems: string[];
  hours: number;
  fitter: string | null;
  when: string;
}

export interface DailyReport {
  banner: string;
  assetCount: number;
  rangeLabel: string;
  kpis: {
    availability: number | null;
    mtbf: number | null;
    mttr: number | null;
    downtimeHours: number;
  };
  failureModes: ParetoRow[];
  systems: ParetoRow[];
  trend: TrendPoint[];
  stoppages: StoppageRow[];
  repeats: RepeatRow[];
  crossTrends: CrossTrend[];
  orders: DrillOrder[];
  empty: boolean;
}

const DELAY_STAGES = new Set([
  'WAITING_PARTS',
  'WAITING_OEM',
  'WAITING_BAY',
  'WAITING_LABOUR',
  'WAITING_PRODUCTION',
  'WEATHER_DELAY',
]);

const STAGE_ACTION: Record<string, string> = {
  WAITING_PARTS: 'Waiting on parts',
  WAITING_OEM: 'Waiting on OEM',
  WAITING_BAY: 'Waiting on a bay',
  WAITING_LABOUR: 'Waiting on labour',
  WAITING_PRODUCTION: 'Waiting on operations release',
  WEATHER_DELAY: 'Weather delay',
  IN_PROGRESS: 'Repair in progress',
  COMPLETED: 'Repair complete',
};

export function machineClass(asset: { assetType?: string | null; makeModel?: string | null; fleetId?: string | null }) {
  const hay = `${asset.assetType ?? ''} ${asset.makeModel ?? ''} ${asset.fleetId ?? ''}`.toLowerCase();
  if (/haul|truck|793|797/.test(hay)) return 'Haul Trucks';
  if (/excav|shovel|digger/.test(hay)) return 'Excavators';
  if (/dozer/.test(hay)) return 'Dozers';
  if (/grader/.test(hay)) return 'Graders';
  if (/drill/.test(hay)) return 'Drills';
  return 'Other';
}

export function rangeForPreset(preset: DatePreset, now = new Date(), custom?: { start: string; end: string }) {
  const end = new Date(now);
  if (preset === '24h') return { start: new Date(end.getTime() - DAY), end, label: 'Last 24h' };
  if (preset === '7d') return { start: new Date(end.getTime() - 7 * DAY), end, label: 'Last 7 days' };
  if (preset === '14d') return { start: new Date(end.getTime() - 14 * DAY), end, label: 'Last 14 days' };
  if (preset === '30d') return { start: new Date(end.getTime() - 30 * DAY), end, label: 'Last 30 days' };
  if (preset === 'mtd') return { start: new Date(end.getFullYear(), end.getMonth(), 1), end, label: 'Month to date' };
  const start = new Date(`${custom?.start || end.toISOString().slice(0, 10)}T00:00:00`);
  const customEnd = new Date(`${custom?.end || end.toISOString().slice(0, 10)}T23:59:59`);
  const safeEnd = customEnd.getTime() >= start.getTime() ? customEnd : start;
  return { start, end: safeEnd, label: `${custom?.start || 'Start'} – ${custom?.end || 'End'}` };
}

function overlapHours(createdAt: string, completedAt: string | null, rangeStart: number, rangeEnd: number, now: number) {
  const start = new Date(createdAt).getTime();
  const finish = completedAt ? new Date(completedAt).getTime() : now;
  const from = Math.max(start, rangeStart);
  const to = Math.min(Number.isFinite(finish) ? finish : now, rangeEnd);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return (to - from) / HOUR;
}

function bucketOf(order: ReportOrder): 'delay' | 'pm' | 'unplanned' | 'skip' {
  if (!order.takesMachineDown) return 'skip';
  if (DELAY_STAGES.has(order.stage)) return 'delay';
  const type = order.orderType.toUpperCase();
  if (type === 'PLANNED' || type === 'PM02' || type.includes('INSPECT')) return 'pm';
  return 'unplanned';
}

function pareto(rows: { name: string; hours: number; orderIds: string[] }[]): ParetoRow[] {
  const total = rows.reduce((sum, row) => sum + row.hours, 0);
  let running = 0;
  return rows
    .sort((a, b) => b.hours - a.hours || b.orderIds.length - a.orderIds.length || a.name.localeCompare(b.name))
    .map((row) => {
      running += row.hours;
      return {
        name: row.name,
        count: row.orderIds.length,
        hours: row.hours,
        cumulative: total > 0 ? (running / total) * 100 : 0,
        orderIds: row.orderIds,
      };
    })
    .slice(0, 8);
}

function dayLabel(date: Date) {
  return `${date.getDate()} ${date.toLocaleString('en-AU', { month: 'short' })}`;
}

export function shortFaultLabel(task: string) {
  const first = task
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/[.\n;]|\s[—–]\s/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  const text = first || 'Unspecified fault';
  return text.length > 48 ? `${text.slice(0, 46).trim()}…` : text;
}

function faultSummary(system: string, task: string) {
  const fault = shortFaultLabel(task);
  if (!system || fault.toLowerCase().includes(system.toLowerCase())) return fault;
  return `${system} · ${fault}`;
}

export function matchingAssets(assets: ReportAsset[], filter: Pick<ReportFilter, 'assetQuery' | 'area' | 'machineClass'>) {
  const query = filter.assetQuery.trim().toLowerCase();
  return assets.filter((asset) => {
    if (query && !`${asset.fleetId} ${asset.makeModel}`.toLowerCase().includes(query)) return false;
    if (filter.area !== 'all') {
      const area = filter.area.toLowerCase();
      const hit = asset.location.toLowerCase() === area || (asset.circuit ?? '').toLowerCase() === area;
      if (!hit) return false;
    }
    if (filter.machineClass !== 'all' && machineClass(asset) !== filter.machineClass) return false;
    return true;
  });
}

export function buildDailyReport(assets: ReportAsset[], orders: ReportOrder[], filter: ReportFilter, now = new Date()): DailyReport {
  const range = rangeForPreset(filter.preset, now, { start: filter.start, end: filter.end });
  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();
  const scoped = matchingAssets(assets, filter);
  const ids = new Set(scoped.map((asset) => asset.id));
  const byId = new Map(scoped.map((asset) => [asset.id, asset]));
  const inScope = orders.filter((order) => ids.has(order.assetId));
  const touched = inScope.filter((order) => overlapHours(order.createdAt, order.completedAt, rangeStart, rangeEnd, now.getTime()) > 0
    || (new Date(order.createdAt).getTime() >= rangeStart && new Date(order.createdAt).getTime() <= rangeEnd));

  const modeMap = new Map<string, { name: string; hours: number; orderIds: string[] }>();
  const systemMap = new Map<string, { name: string; hours: number; orderIds: string[] }>();
  let unplannedHours = 0;
  let plannedHours = 0;
  let delayHours = 0;
  let failureCount = 0;

  const span = Math.max(rangeEnd - rangeStart, HOUR);
  const bucketCount = span <= 36 * HOUR ? 8 : Math.min(31, Math.ceil(span / DAY));
  const bucketMs = span / bucketCount;
  const trend: TrendPoint[] = Array.from({ length: bucketCount }, (_, index) => {
    const at = new Date(rangeStart + index * bucketMs);
    const clock = at.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { label: bucketCount <= 8 ? clock : dayLabel(at), unplanned: 0, planned: 0, delay: 0 };
  });

  for (const order of touched) {
    const hours = overlapHours(order.createdAt, order.completedAt, rangeStart, rangeEnd, now.getTime());
    if (hours <= 0) continue;
    const kind = bucketOf(order);
    if (kind === 'skip') continue;
    if (kind === 'delay') delayHours += hours;
    else if (kind === 'pm') plannedHours += hours;
    else {
      unplannedHours += hours;
      if (new Date(order.createdAt).getTime() >= rangeStart && new Date(order.createdAt).getTime() <= rangeEnd) failureCount += 1;
    }
    const start = new Date(order.createdAt).getTime();
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((start - rangeStart) / bucketMs)));
    trend[index][kind === 'pm' ? 'planned' : kind === 'delay' ? 'delay' : 'unplanned'] += hours;

    const modeName = shortFaultLabel(order.task);
    const mode = modeMap.get(modeName.toLowerCase()) ?? { name: modeName, hours: 0, orderIds: [] };
    mode.hours += kind === 'unplanned' || kind === 'delay' ? hours : 0;
    if (kind !== 'pm') mode.orderIds.push(order.id);
    modeMap.set(modeName.toLowerCase(), mode);

    const systems = order.systems.length > 0 ? order.systems : ['General'];
    const share = (kind === 'unplanned' || kind === 'delay' ? hours : 0) / systems.length;
    for (const system of systems) {
      const row = systemMap.get(system) ?? { name: system, hours: 0, orderIds: [] };
      row.hours += share;
      if (kind !== 'pm' && !row.orderIds.includes(order.id)) row.orderIds.push(order.id);
      systemMap.set(system, row);
    }
  }

  const calendar = (span / HOUR) * Math.max(scoped.length, 0);
  const loss = unplannedHours + delayHours;
  const availability = calendar > 0 ? Math.max(0, Math.min(100, ((calendar - loss) / calendar) * 100)) : null;
  const operating = Math.max(calendar - unplannedHours, 0);

  const stoppageStart = rangeEnd - DAY;
  const stoppages: StoppageRow[] = inScope
    .filter((order) => {
      const created = new Date(order.createdAt).getTime();
      const open = order.status !== 'COMPLETED';
      return open || (created >= stoppageStart && created <= rangeEnd);
    })
    .map((order) => {
      const asset = byId.get(order.assetId);
      const status: StoppageRow['status'] = asset?.status.startsWith('DOWN')
        ? 'Down'
        : order.status !== 'COMPLETED'
          ? 'Derated'
          : 'Operational';
      const action = STAGE_ACTION[order.stage] ?? order.stage.replaceAll('_', ' ').toLowerCase();
      return {
        id: order.id,
        fleetId: asset?.fleetId ?? 'Machine',
        machineClass: asset ? machineClass(asset) : 'Other',
        fault: faultSummary(order.systems[0] ?? 'General', order.task),
        hours: overlapHours(order.createdAt, order.completedAt, stoppageStart, rangeEnd, now.getTime())
          || overlapHours(order.createdAt, order.completedAt, rangeStart, rangeEnd, now.getTime()),
        status,
        nextAction: order.fitter ? `${action} · ${order.fitter}` : action,
      };
    })
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 20);

  const lookbackStart = rangeEnd - filter.lookbackDays * DAY;
  const repeatGroups = new Map<string, ReportOrder[]>();
  for (const order of inScope) {
    if (bucketOf(order) === 'pm' || bucketOf(order) === 'skip') continue;
    const when = new Date(order.createdAt).getTime();
    if (when < lookbackStart || when > rangeEnd) continue;
    const system = order.systems[0]?.trim() || 'General';
    const key = `${order.assetId}::${system}`;
    repeatGroups.set(key, [...(repeatGroups.get(key) ?? []), order]);
  }
  const repeats: RepeatRow[] = [...repeatGroups.entries()]
    .filter(([, jobs]) => jobs.length >= 2)
    .map(([, jobs]) => {
      const sorted = [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const latest = sorted[sorted.length - 1];
      const prior = sorted[sorted.length - 2];
      const asset = byId.get(latest.assetId);
      const inRange = sorted.filter((job) => {
        const when = new Date(job.createdAt).getTime();
        return when >= rangeStart && when <= rangeEnd;
      });
      const gap = (new Date(latest.createdAt).getTime() - new Date(prior.createdAt).getTime()) / HOUR;
      return {
        fleetId: asset?.fleetId ?? 'Machine',
        machineClass: asset ? machineClass(asset) : 'Other',
        system: latest.systems[0] ?? 'General',
        countInRange: inRange.length,
        countInLookback: sorted.length,
        hoursSincePrior: Number.isFinite(gap) && gap > 0 ? gap : null,
        lastRepair: latest.task.trim() || 'Breakdown',
        crew: latest.fitter || 'Unassigned',
      };
    })
    .sort((a, b) => b.countInLookback - a.countInLookback || a.fleetId.localeCompare(b.fleetId));

  const crossMap = new Map<string, { machineClass: string; system: string; assets: Set<string>; count: number }>();
  for (const order of touched) {
    if (bucketOf(order) === 'pm' || bucketOf(order) === 'skip') continue;
    const asset = byId.get(order.assetId);
    if (!asset) continue;
    const system = order.systems[0]?.trim() || 'General';
    const kind = machineClass(asset);
    const key = `${kind}::${system}`;
    const group = crossMap.get(key) ?? { machineClass: kind, system, assets: new Set<string>(), count: 0 };
    group.assets.add(asset.fleetId);
    group.count += 1;
    crossMap.set(key, group);
  }
  const crossTrends = [...crossMap.values()]
    .filter((group) => group.assets.size >= 2)
    .map((group) => ({ machineClass: group.machineClass, system: group.system, assets: [...group.assets], count: group.count }))
    .sort((a, b) => b.assets.length - a.assets.length || b.count - a.count);

  const scopeName = filter.assetQuery.trim()
    || (filter.machineClass !== 'all' ? filter.machineClass : '')
    || (filter.area !== 'all' ? filter.area : 'All fleets');
  const drillOrders: DrillOrder[] = touched.map((order) => ({
    id: order.id,
    fleetId: byId.get(order.assetId)?.fleetId ?? 'Machine',
    woNumber: order.woNumber,
    task: order.task,
    systems: order.systems,
    hours: overlapHours(order.createdAt, order.completedAt, rangeStart, rangeEnd, now.getTime()),
    fitter: order.fitter,
    when: order.createdAt,
  }));

  return {
    banner: `${scopeName} · ${range.label} · ${scoped.length} machine${scoped.length === 1 ? '' : 's'}`,
    assetCount: scoped.length,
    rangeLabel: range.label,
    kpis: {
      availability,
      mtbf: failureCount > 0 ? operating / failureCount : null,
      mttr: failureCount > 0 ? unplannedHours / failureCount : null,
      downtimeHours: unplannedHours + plannedHours + delayHours,
    },
    failureModes: pareto([...modeMap.values()].filter((row) => row.orderIds.length > 0)),
    systems: pareto([...systemMap.values()].filter((row) => row.orderIds.length > 0)),
    trend,
    stoppages,
    repeats,
    crossTrends,
    orders: drillOrders,
    empty: scoped.length === 0 || touched.length === 0,
  };
}

export function reportAreas(assets: ReportAsset[]) {
  const names = new Set<string>();
  for (const asset of assets) {
    if (asset.location.trim()) names.add(asset.location.trim());
    if (asset.circuit?.trim()) names.add(asset.circuit.trim());
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function dailyReportCsv(report: DailyReport) {
  const lines = [
    'Section,Name,Count,Hours,Cumulative %,Detail',
    ...report.failureModes.map((row) => `Failure mode,"${row.name.replaceAll('"', '""')}",${row.count},${row.hours.toFixed(1)},${row.cumulative.toFixed(0)}%,`),
    ...report.systems.map((row) => `System,"${row.name.replaceAll('"', '""')}",${row.count},${row.hours.toFixed(1)},${row.cumulative.toFixed(0)}%,`),
    `KPI,Availability %,,,${report.kpis.availability?.toFixed(1) ?? ''},`,
    `KPI,MTBF hours,,,${report.kpis.mtbf?.toFixed(1) ?? ''},`,
    `KPI,MTTR hours,,,${report.kpis.mttr?.toFixed(1) ?? ''},`,
    `KPI,Total downtime hours,${report.kpis.downtimeHours.toFixed(1)},,,`,
    ...report.stoppages.map((row) => `Stoppage,"${row.fleetId}",,${row.hours.toFixed(1)},${row.status},"${row.fault.replaceAll('"', '""')} · ${row.nextAction.replaceAll('"', '""')}"`),
    ...report.repeats.map((row) => `Repeat,"${row.fleetId} ${row.system}",${row.countInLookback},,,"${row.lastRepair.replaceAll('"', '""')} · ${row.crew}"`),
  ];
  return lines.join('\n');
}

export function hoursLabel(hours: number | null) {
  if (hours == null || !Number.isFinite(hours)) return '—';
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}
