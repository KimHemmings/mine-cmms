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

export function serviceDue(asset: Pick<Asset, 'current_smu' | 'next_service_smu' | 'statutory_inspection_due'>, today = todayIso()) {
  const due = (asset.statutory_inspection_due ?? '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(due) && due <= today) return true;
  const current = Number(asset.current_smu);
  const next = Number(asset.next_service_smu);
  return Number.isFinite(current) && Number.isFinite(next) && next - current <= 25;
}
