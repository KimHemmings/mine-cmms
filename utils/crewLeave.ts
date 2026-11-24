import { CrewMember } from '@/types';

export const LEAVE_TYPES = ['Annual Leave', 'Sick / Personal', 'Training / Medical', 'LSL / Parental', 'Other'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export interface CrewLeave {
  id: string;
  crew_member_id: string;
  leave_type: LeaveType | string;
  start_date: string;
  end_date: string;
  status: 'Approved' | 'Pending' | string;
  notes: string | null;
  created_by: string | null;
}

export function localDateIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function shiftDateIso(shiftDate?: string | null, now = new Date()) {
  if (shiftDate && /^\d{4}-\d{2}-\d{2}/.test(shiftDate)) return shiftDate.slice(0, 10);
  return localDateIso(now);
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  return localDateIso(date);
}

export function leaveCovers(row: Pick<CrewLeave, 'start_date' | 'end_date' | 'status'>, day: string, approvedOnly = false) {
  if (approvedOnly && row.status !== 'Approved') return false;
  return row.start_date.slice(0, 10) <= day && row.end_date.slice(0, 10) >= day;
}

export function approvedLeaveOn(rows: CrewLeave[], memberId: string, day: string) {
  return rows
    .filter((row) => row.crew_member_id === memberId && leaveCovers(row, day, true))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null;
}

export function applyShiftLeave(members: CrewMember[], rows: CrewLeave[], shiftDate?: string | null): CrewMember[] {
  const day = shiftDateIso(shiftDate);
  return members.map((member) => {
    const leave = approvedLeaveOn(rows, member.id, day);
    if (!leave) return { ...member, on_leave: false, leave_type: null, leave_id: null };
    return { ...member, away: true, on_leave: true, leave_type: leave.leave_type, leave_id: leave.id };
  });
}

export function leaveTone(type: string) {
  if (type === 'Annual Leave') return 'bg-blue-600 text-white';
  if (type === 'Sick / Personal') return 'bg-rose-600 text-white';
  if (type === 'Training / Medical') return 'bg-amber-500 text-slate-950';
  if (type === 'LSL / Parental') return 'bg-slate-600 text-white';
  return 'bg-violet-700 text-white';
}

export function shortDay(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString('en-AU', { weekday: 'narrow', day: 'numeric' });
}
