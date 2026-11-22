import { Asset, CrewMember } from '@/types';

export const OT_REASONS = ['Annual Leave Cover', 'Unplanned Absence', 'Open Vacancy', 'Breakdown Surge'] as const;
export type OvertimeReason = (typeof OT_REASONS)[number];

export function todayIso(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function fatigueGate(lastEnded: string | null | undefined, now = Date.now()) {
  if (!lastEnded) return null;
  const ended = new Date(lastEnded).getTime();
  if (!Number.isFinite(ended)) return null;
  const breakHours = (now - ended) / 3_600_000;
  const spanHours = breakHours < 10 ? 12 + breakHours : 0;
  if (breakHours < 10 || spanHours > 14) {
    return { breakHours, spanHours };
  }
  return null;
}

export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired';

export function expiryState(value: string | null | undefined, today = todayIso()): ExpiryState {
  const day = (value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'none';
  if (day < today) return 'expired';
  const limit = new Date(`${today}T00:00:00`);
  limit.setDate(limit.getDate() + 30);
  const soon = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`;
  return day <= soon ? 'soon' : 'ok';
}

export function operatorBlockReason(member: Pick<CrewMember, 'medical_expiry' | 'standard11_expiry' | 'voc_expiries'>, model?: string, today = todayIso()) {
  if (expiryState(member.medical_expiry, today) === 'expired') return 'Coal Board Medical expired';
  if (expiryState(member.standard11_expiry, today) === 'expired') return 'Standard 11 expired';
  if (model && expiryState(member.voc_expiries?.[model], today) === 'expired') return `${model} VOC expired`;
  return null;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A stored SMU counts only when it is a real positive number. Null and 0 do not. */
function positiveSmu(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function shortDate(iso: string) {
  const [, month, day] = iso.split('-');
  return `${SHORT_MONTHS[Number(month) - 1]} ${Number(day)}`;
}

export interface ServiceAlert {
  kind: 'statutory' | 'smu';
  label: string;
  title: string;
}

export function statutoryInspectionDue(asset: Pick<Asset, 'statutory_inspection_due'>, today = todayIso()) {
  const raw = asset.statutory_inspection_due;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const due = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return null;
  if (Number.isNaN(new Date(`${due}T00:00:00`).getTime())) return null;
  return due <= today ? due : null;
}

export function smuHoursToService(asset: Pick<Asset, 'current_smu' | 'next_service_smu'>) {
  const current = positiveSmu(asset.current_smu);
  const next = positiveSmu(asset.next_service_smu);
  if (current == null || next == null) return null;
  const remaining = next - current;
  return remaining <= 25 ? remaining : null;
}

export function isOpenPlannedService(order: { status?: string | null; order_type?: string | null }) {
  if (order.status === 'COMPLETED') return false;
  const raw = (order.order_type || '').toUpperCase();
  if (!raw) return false;
  if (raw.includes('INSPECT')) return true;
  return raw === 'PLANNED' || raw === 'PM02';
}

export function serviceAlerts(
  asset: Pick<Asset, 'current_smu' | 'next_service_smu' | 'statutory_inspection_due'>,
  options?: { suppressSmu?: boolean },
  today = todayIso(),
): ServiceAlert[] {
  const alerts: ServiceAlert[] = [];
  const due = statutoryInspectionDue(asset, today);
  if (due) {
    alerts.push({
      kind: 'statutory',
      label: `Stat Due • ${shortDate(due)}`,
      title: `Statutory inspection due ${shortDate(due)}`,
    });
  }
  if (!options?.suppressSmu) {
    const remaining = smuHoursToService(asset);
    if (remaining != null) {
      const current = positiveSmu(asset.current_smu);
      const next = positiveSmu(asset.next_service_smu);
      const rounded = Math.round(remaining);
      const hours = remaining <= 0 ? 'overdue' : `${rounded === 0 ? remaining.toFixed(1) : rounded}h remaining`;
      alerts.push({
        kind: 'smu',
        label: remaining <= 0 ? 'PM Overdue' : `PM in ${rounded === 0 ? remaining.toFixed(1) : rounded}h`,
        title: `Current SMU ${current}. Next service ${next}. ${hours}.`,
      });
    }
  }
  return alerts;
}

export function serviceDue(asset: Pick<Asset, 'current_smu' | 'next_service_smu' | 'statutory_inspection_due'>, today = todayIso()) {
  return serviceAlerts(asset, undefined, today).length > 0;
}
