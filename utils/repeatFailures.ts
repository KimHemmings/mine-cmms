import { Asset, MachineWorkOrder } from '@/types';

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface RepeatFailure {
  assetId: string;
  fleetId: string;
  component: string;
  count: number;
  hours: number;
  detail: string;
}

type RepeatOrder = Pick<MachineWorkOrder, 'asset_id' | 'order_type' | 'component_systems' | 'created_at' | 'completed_at' | 'status' | 'task_description'>;

function isRoutine(orderType?: string | null) {
  const raw = (orderType || '').toUpperCase();
  if (!raw) return false;
  if (raw.includes('INSPECT')) return true;
  return raw === 'PLANNED' || raw === 'PM02';
}

function shortWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function downHours(order: RepeatOrder, now: number) {
  const start = new Date(order.created_at).getTime();
  const end = order.completed_at ? new Date(order.completed_at).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 3_600_000;
}

export function formatDownHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return '0h';
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

export function repeatFailures(orders: RepeatOrder[], assets: Pick<Asset, 'id' | 'fleet_id'>[], now = Date.now()): RepeatFailure[] {
  const fleet = new Map(assets.map((asset) => [asset.id, asset.fleet_id]));
  const windowStart = now - WINDOW_MS;
  const groups = new Map<string, { assetId: string; component: string; jobs: RepeatOrder[] }>();
  for (const order of orders) {
    if (!order.asset_id || !order.created_at || isRoutine(order.order_type)) continue;
    const when = new Date(order.created_at).getTime();
    if (!Number.isFinite(when) || when < windowStart) continue;
    const components = (order.component_systems ?? []).map((item) => item.trim()).filter(Boolean);
    for (const component of components) {
      const key = `${order.asset_id}::${component}`;
      const group = groups.get(key) ?? { assetId: order.asset_id, component, jobs: [] };
      group.jobs.push(order);
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .filter((group) => group.jobs.length >= 2)
    .map((group) => {
      const jobs = [...group.jobs].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const prior = jobs.slice(0, -1);
      const history = prior.map((job) => `${shortWhen(job.created_at)} (${job.task_description?.trim() || 'Breakdown'})`).join(', ');
      return {
        assetId: group.assetId,
        fleetId: fleet.get(group.assetId) ?? 'Machine',
        component: group.component,
        count: jobs.length,
        hours: jobs.reduce((sum, job) => sum + downHours(job, now), 0),
        detail: `Prior failures: ${history} — Check root cause`,
      };
    })
    .sort((a, b) => b.count - a.count || b.hours - a.hours || a.fleetId.localeCompare(b.fleetId, undefined, { numeric: true }));
}

export function repeatsForAsset(failures: RepeatFailure[], assetId: string) {
  return failures.filter((item) => item.assetId === assetId);
}
